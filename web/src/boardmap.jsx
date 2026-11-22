import { useEffect, useRef, useState } from "react";
import { strings } from "./i18n.js";
import { useLab } from "./state.jsx";

const TYPE_INK = {
  "5V": "var(--ov-5v)",
  "3V3": "var(--ov-3v3)",
  GND: "var(--ov-gnd)",
  gpio: "var(--ov-gpio)",
  i2c: "var(--ov-i2c)",
  spi: "var(--ov-spi)",
  uart: "var(--ov-uart)",
  pwm: "var(--ov-pwm)",
  id: "var(--ov-id)",
};

function pinInk(pin) {
  if (pin.name === "5V") return TYPE_INK["5V"];
  if (pin.name === "3V3") return TYPE_INK["3V3"];
  if (pin.name === "GND") return TYPE_INK.GND;
  const alts = Object.values(pin.alt_matrix || {}).join(" ");
  if (/SDA|SCL|I2C/.test(alts) && pin.physical <= 5) return TYPE_INK.i2c;
  if (/SPI/.test(alts)) return TYPE_INK.spi;
  if (/TXD|RXD|UART/.test(alts)) return TYPE_INK.uart;
  if (/PWM/.test(alts)) return TYPE_INK.pwm;
  if (pin.physical === 27 || pin.physical === 28) return TYPE_INK.id;
  return TYPE_INK.gpio;
}

function roundRect(x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  return `M ${x + rr} ${y} H ${x + w - rr} A ${rr} ${rr} 0 0 1 ${x + w} ${y + rr} V ${y + h - rr} A ${rr} ${rr} 0 0 1 ${x + w - rr} ${y + h} H ${x + rr} A ${rr} ${rr} 0 0 1 ${x} ${y + h - rr} V ${y + rr} A ${rr} ${rr} 0 0 1 ${x + rr} ${y} Z`;
}

export function BoardMap({ board, pinout, header, mounts, parts, layers, selected, onSelect, onView, onOpenLayers, mode = "explore", onMode, onMeasure }) {
  const t = strings(useLab().lang);
  const svgRef = useRef(null);
  const [view, setView] = useState(null);
  const [px, setPx] = useState(8);
  const [cursor, setCursor] = useState(null);
  const [focusPin, setFocusPin] = useState(1);
  const [kbd, setKbd] = useState(false);
  const drag = useRef(null);
  const W = board.outline.w_mm.value;
  const H = board.outline.h_mm.value;
  const R = board.outline.corner_radius_mm.value;

  function fit() {
    const el = svgRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (!rect.width) return;
    const margin = 1;
    const w = W + margin * 2;
    const h = w * (rect.height / rect.width);
    setView({ x: -margin, y: (H - h) / 2, w, h });
  }

  useEffect(() => {
    fit();
  }, [W, H]);

  useEffect(() => {
    const el = svgRef.current;
    if (!el || !view) return;
    const rect = el.getBoundingClientRect();
    const next = rect.width / view.w;
    setPx(next);
    onView?.({ ...view, px: next, wBoard: W, hBoard: H });
  }, [view]);

  function zoomAt(factor, clientX, clientY) {
    const el = svgRef.current;
    if (!el || !view) return;
    const rect = el.getBoundingClientRect();
    const mx = view.x + ((clientX - rect.left) / rect.width) * view.w;
    const my = view.y + ((clientY - rect.top) / rect.height) * view.h;
    const minW = rect.width / 60;
    const nextW = Math.min(W + 40, Math.max(minW, view.w / factor));
    const nextH = nextW * (rect.height / rect.width);
    const relX = (mx - view.x) / view.w;
    const relY = (my - view.y) / view.h;
    setView({ x: mx - relX * nextW, y: my - relY * nextH, w: nextW, h: nextH });
  }

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const wheel = (event) => {
      event.preventDefault();
      zoomAt(event.deltaY < 0 ? 1.12 : 1 / 1.12, event.clientX, event.clientY);
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  });

  function toWorld(event) {
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: view.x + ((event.clientX - rect.left) / rect.width) * view.w,
      y: view.y + ((event.clientY - rect.top) / rect.height) * view.h,
    };
  }

  const showPads = px >= 4;
  const showNumbers = px >= 10 && layers.pins;
  const authoredY = (svgY) => H - svgY;
  function chipAt(pin) {
    if (!view || !svgRef.current || !pin) return null;
    const rect = svgRef.current.getBoundingClientRect();
    const host = svgRef.current.parentElement.getBoundingClientRect();
    if (!rect.width) return null;
    return {
      left: rect.left - host.left + ((pin.x - view.x) / view.w) * rect.width,
      top: rect.top - host.top + ((pin.y - view.y) / view.h) * rect.height,
    };
  }
  const focusChip = kbd ? chipAt(board.header.pins.find((row) => row.physical === focusPin)) : null;
  const selectedPad = selected?.kind === "pin" ? board.header.pins.find((row) => row.physical === selected.physical) : null;
  const selectedRecord = selectedPad ? pinout?.pins?.find((row) => row.physical === selectedPad.physical) : null;
  const calloutAt = chipAt(selectedPad);
  const calloutAlt = selectedRecord ? Object.values(selectedRecord.alt_matrix || {})[0] : "";

  return (
    <div className="map-wrap">
      <svg
        id="board"
        ref={svgRef}
        className="pz-board"
        tabIndex={0}
        role="application"
        aria-label={t.boardKeys}
        data-zoom={px < 6 ? "far" : px > 16 ? "close" : "near"}
        viewBox={view ? `${view.x} ${view.y} ${view.w} ${view.h}` : `0 0 ${W} ${H}`}
        onFocus={() => setKbd(true)}
        onBlur={() => setKbd(false)}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            setFocusPin((pin) => Math.max(1, pin - 2));
          } else if (event.key === "ArrowRight") {
            event.preventDefault();
            setFocusPin((pin) => (pin + 2 <= 40 ? pin + 2 : pin));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setFocusPin((pin) => (pin % 2 === 1 ? pin + 1 : pin));
          } else if (event.key === "ArrowDown") {
            event.preventDefault();
            setFocusPin((pin) => (pin % 2 === 0 ? pin - 1 : pin));
          } else if (event.key === "Enter") {
            event.preventDefault();
            onSelect({ kind: "pin", physical: focusPin });
          }
        }}
        onPointerDown={(event) => {
          drag.current = { x: event.clientX, y: event.clientY, ox: event.clientX, oy: event.clientY, view, id: event.pointerId, captured: false };
        }}
        onPointerMove={(event) => {
          if (view) {
            const world = toWorld(event);
            setCursor({ x: world.x, y: authoredY(world.y) });
          }
          if (!drag.current || !view) return;
          if (!drag.current.captured) {
            const moved = Math.hypot(event.clientX - drag.current.ox, event.clientY - drag.current.oy);
            if (moved <= 4) return;
            drag.current.captured = true;
            event.currentTarget.setPointerCapture(drag.current.id);
          }
          const rect = svgRef.current.getBoundingClientRect();
          const dx = ((event.clientX - drag.current.x) / rect.width) * view.w;
          const dy = ((event.clientY - drag.current.y) / rect.height) * view.h;
          drag.current = { ...drag.current, x: event.clientX, y: event.clientY, view };
          setView({ ...view, x: view.x - dx, y: view.y - dy });
        }}
        onPointerUp={() => { drag.current = null; }}
        onPointerCancel={() => { drag.current = null; }}
      >
        <defs>
          <linearGradient id="pz-mask" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#1f6a47" />
            <stop offset="0.55" stopColor="#1b5e3f" />
            <stop offset="1" stopColor="#164f35" />
          </linearGradient>
          <radialGradient id="pz-enig" cx="0.35" cy="0.3" r="0.75">
            <stop offset="0" stopColor="#fbe9a6" />
            <stop offset="0.45" stopColor="#e3c26a" />
            <stop offset="1" stopColor="#b08a33" />
          </radialGradient>
          <radialGradient id="pz-solder" cx="0.35" cy="0.3" r="0.8">
            <stop offset="0" stopColor="#f4f6f8" />
            <stop offset="0.35" stopColor="#c3c9d0" />
            <stop offset="0.8" stopColor="#7d858e" />
            <stop offset="1" stopColor="#5b626a" />
          </radialGradient>
          <linearGradient id="pz-epoxy" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2a2c32" />
            <stop offset="1" stopColor="#16171a" />
          </linearGradient>
          <linearGradient id="pz-steel" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#c3c8cf" />
            <stop offset="1" stopColor="#8b929b" />
          </linearGradient>
          <linearGradient id="pz-pa" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#17181c" />
            <stop offset="1" stopColor="#0f1013" />
          </linearGradient>
          <linearGradient id="pz-pin" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff1b8" />
            <stop offset="0.5" stopColor="#e2bf55" />
            <stop offset="1" stopColor="#9c7a22" />
          </linearGradient>
          <filter id="pz-lift" x="-20%" y="-20%" width="140%" height="140%" filterUnits="objectBoundingBox" colorInterpolationFilters="sRGB">
            <feDropShadow dx="0.25" dy="0.35" stdDeviation="0.35" floodColor="#000" floodOpacity="0.45" />
          </filter>
        </defs>
        <rect className="bench-fill" x={-30} y={-30} width={W + 60} height={H + 60} />
        {layers.measurements && view && (
          <g className="pz-overlay grid">
            {Array.from({ length: Math.ceil(W / 5) + 1 }, (_, i) => (
              <line key={`v${i}`} x1={i * 5} y1={0} x2={i * 5} y2={H} />
            ))}
            {Array.from({ length: Math.ceil(H / 5) + 1 }, (_, i) => (
              <line key={`h${i}`} x1={0} y1={i * 5} x2={W} y2={i * 5} />
            ))}
          </g>
        )}
        <path className="pz-part fr4" fillRule="evenodd" d={`${roundRect(0, 0, W, H, R)} ${roundRect(0.25, 0.25, W - 0.5, H - 0.5, Math.max(0, R - 0.25))}`} />
        <path className="pz-part mask" d={roundRect(0.25, 0.25, W - 0.5, H - 0.5, Math.max(0, R - 0.25))} />
        {board.holes.map((hole, index) => (
          <g key={index} className="pz-part">
            <circle cx={hole.x} cy={hole.y} r={hole.d / 2 + 0.6} fill="url(#pz-enig)" />
            <circle cx={hole.x} cy={hole.y} r={hole.d / 2} fill="var(--bench)" />
          </g>
        ))}
        {layers.components && board.draw.map((part) => (
          <g key={part.id} className="pz-part" filter={part.kind === "soc" ? null : "url(#pz-lift)"} onClick={(event) => { event.stopPropagation(); onSelect({ kind: "component", id: part.id }); }}>
            {part.kind === "microsd" && (
              <rect x={part.x - 6} y={part.y + 1.5} width={6} height={part.h - 3} fill="#5c6572" />
            )}
            <rect
              x={part.x}
              y={part.y}
              width={part.w}
              height={part.h}
              rx={part.kind === "soc" ? 0.3 : 0.4}
              fill={part.kind === "soc" ? "url(#pz-epoxy)" : part.kind === "csi" ? "#ece6d6" : "url(#pz-steel)"}
            />
            {layers.silk && px >= 6 && (
              <text x={part.x + part.w / 2} y={part.y + part.h / 2} textAnchor="middle" className="silk-label">
                {part.kind === "soc" ? "BCM2835" : part.kind === "mini-hdmi" ? "mini-HDMI" : part.kind === "usb-otg" ? "USB OTG" : part.kind === "usb-pwr" ? "USB PWR" : part.kind === "microsd" ? "SD" : part.kind === "csi" ? "CSI" : ""}
              </text>
            )}
          </g>
        ))}
        {mounts.map((mount) => {
          const part = parts.find((item) => item.id === mount.partId);
          if (!part?.dims) return null;
          return (
            <g key={mount.id} className="pz-part" filter="url(#pz-lift)" onClick={(event) => { event.stopPropagation(); onSelect({ kind: "part", id: part.id }); }}>
              <rect x={mount.x_mm} y={mount.y_mm} width={part.dims.w_mm} height={part.dims.h_mm} rx={0.4} fill="#143526" />
              <path fill="#2a7a52" fillRule="evenodd" d={`${roundRect(mount.x_mm, mount.y_mm, part.dims.w_mm, part.dims.h_mm, 0.4)} ${roundRect(mount.x_mm + 0.4, mount.y_mm + 0.4, part.dims.w_mm - 0.8, part.dims.h_mm - 0.8, 0.2)}`} />
              {layers.silk && (
                <text x={mount.x_mm + 2} y={mount.y_mm + Math.min(4, part.dims.h_mm - 1)} className="silk-label">{part.name.en}</text>
              )}
            </g>
          );
        })}
        {layers.pads && showPads && board.header.pins.map((pin) => (
          <g key={pin.physical} className="pz-part" data-pin={pin.physical} onClick={(event) => { event.stopPropagation(); onSelect({ kind: "pin", physical: pin.physical }); }}>
            {header === "bare" && (
              <>
                <circle data-pin={pin.physical} cx={pin.x} cy={pin.y} r={board.header.padD / 2} fill="url(#pz-enig)" />
                <circle cx={pin.x} cy={pin.y} r={board.header.drillD / 2} fill="var(--bench)" style={{ pointerEvents: "none" }} />
              </>
            )}
            {header !== "bare" && (
              <circle cx={pin.x} cy={pin.y} r={board.header.padD / 2} fill={header === "solder" ? "url(#pz-solder)" : "url(#pz-enig)"} />
            )}
          </g>
        ))}
        {header === "solder" && (
          <g className="pz-part" filter="url(#pz-lift)">
            <rect x={board.header.x} y={board.header.y} width={board.header.w} height={board.header.h} rx={0.3} fill="url(#pz-pa)" />
            {board.header.pins.map((pin) => (
              <rect key={`post-${pin.physical}`} x={pin.x - 0.32} y={pin.y - 0.32} width={0.64} height={0.64} fill="url(#pz-pin)" />
            ))}
          </g>
        )}
        {header === "hammer" && (
          <g className="pz-part">
            <rect x={board.header.x} y={board.header.y + board.header.h / 2 - 0.55} width={board.header.w} height={1.1} rx={0.15} fill="#4a5160" />
            {board.header.pins.map((pin) => (
              <rect key={`peg-${pin.physical}`} x={pin.x - 0.16} y={pin.y - 0.62} width={0.32} height={0.26} fill="url(#pz-pin)" />
            ))}
          </g>
        )}
        {layers.pins && showPads && board.header.pins.map((pin) => {
          const record = pinout?.pins?.find((row) => row.physical === pin.physical) || pin;
          return <circle key={`ring-${pin.physical}`} className="pz-overlay pin-ring" cx={pin.x} cy={pin.y} r={board.header.padD / 2 + 0.12} stroke={pinInk(record)} />;
        })}
        {selected?.kind === "pin" && board.header.pins.filter((pin) => pin.physical === selected.physical).map((pin) => (
          <g key="sel" className="pz-overlay">
            <circle className="pin-select" cx={pin.x} cy={pin.y} r={board.header.padD / 2 + 0.12} stroke="var(--ov-select)" />
          </g>
        ))}
        {kbd && board.header.pins.filter((pin) => pin.physical === focusPin).map((pin) => (
          <g key="focus" className="pz-overlay">
            <circle cx={pin.x} cy={pin.y} r={board.header.padD / 2 + 0.28} stroke="var(--focus)" />
          </g>
        ))}
        {layers.measurements && (
          <g className="pz-overlay dims">
            <line x1="0" y1={H + 1.4} x2={W} y2={H + 1.4} />
            <line x1={W + 1.4} y1="0" x2={W + 1.4} y2={H} />
          </g>
        )}
        {showNumbers && board.header.pins.filter((pin) => {
          const focus = selected?.kind === "pin" ? selected.physical : (kbd ? focusPin : 0);
          return focus && Math.abs(pin.physical - focus) <= 2;
        }).map((pin) => (
          <text key={`n-${pin.physical}`} x={pin.x} y={pin.y - 1.15} textAnchor="middle" className="pin-num">{pin.physical}</text>
        ))}
      </svg>
      {focusChip && <span className="focus-chip" style={{ left: focusChip.left, top: focusChip.top }}>{board.header.pins.find((row) => row.physical === focusPin)?.name}</span>}
      {calloutAt && selectedPad && (
        <span className="callout" style={{ left: calloutAt.left, top: calloutAt.top }}>
          {`Pin ${selectedPad.physical} · ${selectedPad.name}${calloutAlt ? ` · ${calloutAlt}` : ""}`}
        </span>
      )}
      {layers.measurements && view && (
        <span className="callout dim" style={{ left: "50%", top: "auto", bottom: 36 }}>{`${W.toFixed(2)} mm`}</span>
      )}
      <div className="map-tools">
        {onOpenLayers && <button type="button" className="layers-toggle" onClick={onOpenLayers}>{t.layers}</button>}
        <button type="button" className={mode === "explore" ? "on" : ""} onClick={() => onMode?.("explore")}>{t.explore}</button>
        <button type="button" className={mode === "bench" ? "on" : ""} onClick={() => onMode?.("bench")}>{t.bench}</button>
        <button type="button">{t.top}</button>
        <button type="button" disabled>{t.bottom}</button>
        <button type="button" disabled>{t.side}</button>
        <button type="button" onClick={fit}>{t.fit}</button>
        <button type="button" disabled>{t.oneToOne}</button>
        <button type="button" className={layers.measurements ? "on" : ""} onClick={onMeasure}>{t.measure}</button>
      </div>
      <div className="zoom-dock">
        <button type="button" aria-label={t.zoomIn} onClick={() => zoomAt(1.25, centerOf(svgRef).x, centerOf(svgRef).y)}>+</button>
        <button type="button" aria-label={t.zoomOut} onClick={() => zoomAt(1 / 1.25, centerOf(svgRef).x, centerOf(svgRef).y)}>−</button>
      </div>
    </div>
  );
}

function centerOf(svgRef) {
  const el = svgRef.current;
  if (!el) return { x: 0, y: 0 };
  const rect = el.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

export function Minimap({ board, view, mounts = [], parts = [] }) {
  if (!board) return null;
  const W = board.outline.w_mm.value;
  const H = board.outline.h_mm.value;
  return (
    <svg className="minimap" viewBox={`-2 -2 ${W + 4} ${H + 4}`}>
      <rect className="board-sil" x="0" y="0" width={W} height={H} rx="2" />
      {mounts.map((mount) => {
        const part = parts.find((item) => item.id === mount.partId);
        if (!part?.dims) return null;
        return <rect key={mount.id} x={mount.x_mm} y={mount.y_mm} width={part.dims.w_mm} height={part.dims.h_mm} fill="#143526" fillOpacity="0.4" />;
      })}
      {view && <rect className="pz-overlay" fill="none" x={view.x} y={view.y} width={view.w} height={view.h} />}
    </svg>
  );
}
