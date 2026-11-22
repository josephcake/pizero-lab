import { useEffect, useMemo, useRef, useState } from "react";
import { fitsBoard } from "../../shared/boards.mjs";
import { deriveBom, formatBom, formatPrice } from "../../shared/bench.mjs";
import { BoardMap } from "./boardmap.jsx";
import { tx, useLab } from "./state.jsx";
import { strings } from "./i18n.js";

const MAX_PX = 60;

export function Workbench({ state, onDispatch, compact = false }) {
  const { catalog, lang, setSelection, selection, fading } = useLab();
  const t = strings(lang);
  const svgRef = useRef(null);
  const [view, setView] = useState(null);
  const [px, setPx] = useState(4);
  const pointers = useRef(new Map());
  const drag = useRef(null);

  function measure() {
    const el = svgRef.current;
    if (!el || !view) return;
    const rect = el.getBoundingClientRect();
    setPx(rect.width / view.w);
  }

  const outline = catalog.board.outline;
  const boardW = outline.w_mm.value;
  const boardH = outline.h_mm.value;
  const boardR = outline.corner_radius_mm.value;

  function fit() {
    const el = svgRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const margin = 10;
    const w = boardW + margin * 2;
    const h = w * (rect.height / rect.width);
    setView({ x: -margin, y: (boardH - h) / 2, w, h });
  }

  useEffect(() => {
    fit();
    const observer = new ResizeObserver(() => {
      setView((current) => {
        if (!current || !svgRef.current) return current;
        const rect = svgRef.current.getBoundingClientRect();
        if (!rect.width || !rect.height) return current;
        const h = current.w * (rect.height / rect.width);
        if (!Number.isFinite(h)) return current;
        return { ...current, h };
      });
    });
    if (svgRef.current) observer.observe(svgRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    measure();
  }, [view]);

  function zoomAt(factor, clientX, clientY) {
    const el = svgRef.current;
    if (!el || !view) return;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const mx = view.x + ((clientX - rect.left) / rect.width) * view.w;
    const my = view.y + ((clientY - rect.top) / rect.height) * view.h;
    const minW = rect.width / MAX_PX;
    const nextW = Math.min(140, Math.max(minW, view.w / factor));
    const nextH = nextW * (rect.height / rect.width);
    const relX = (mx - view.x) / view.w;
    const relY = (my - view.y) / view.h;
    setView({ x: mx - relX * nextW, y: my - relY * nextH, w: nextW, h: nextH });
  }

  function onWheel(event) {
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
    zoomAt(factor, event.clientX, event.clientY);
  }

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const handler = (event) => onWheel(event);
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  });

  function onPointerDown(event) {
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 1) {
      drag.current = { x: event.clientX, y: event.clientY, view };
    }
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event) {
    if (!view) return;
    const prev = pointers.current.get(event.pointerId);
    if (!prev) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2) {
      const pts = [...pointers.current.values()];
      const before = Math.hypot(prev.x - pts[0].x, prev.y - pts[0].y) || 1;
      const after = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) || 1;
      if (event.pointerId !== [...pointers.current.keys()][0]) {
        zoomAt(after / before, (pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2);
      }
      return;
    }
    if (!drag.current) return;
    const el = svgRef.current;
    const rect = el.getBoundingClientRect();
    const dx = ((event.clientX - drag.current.x) / rect.width) * view.w;
    const dy = ((event.clientY - drag.current.y) / rect.height) * view.h;
    drag.current = { x: event.clientX, y: event.clientY, view };
    setView({ ...view, x: view.x - dx, y: view.y - dy });
  }

  function onPointerUp(event) {
    pointers.current.delete(event.pointerId);
    drag.current = null;
  }

  const bar = useMemo(() => {
    const choices = [1, 2, 5, 10, 20];
    let best = 10;
    for (const mm of choices) {
      const width = mm * px;
      if (width >= 70 && width <= 150) best = mm;
    }
    return best;
  }, [px]);

  const showEdgeLabel = px >= 8;
  const showCornerLabel = px >= 18;
  const groups = groupParts(catalog.parts.filter((part) => fitsBoard(part, catalog.board.id)));

  return (
    <div className={compact ? "bench compact" : "bench"}>
      <div className={fading ? "bench-stage is-fading" : "bench-stage"}>
        {!compact && <div className="zoom-tools">
          <button type="button" onClick={() => zoomAt(1 / 1.25, center(svgRef).x, center(svgRef).y)}>{t.zoomOut}</button>
          <button type="button" onClick={() => zoomAt(1.25, center(svgRef).x, center(svgRef).y)}>{t.zoomIn}</button>
          <button type="button" onClick={fit}>{t.fit}</button>
          <span className="pxmm">{px.toFixed(1)} px/mm</span>
        </div>}
        {compact ? (
          <div className="compact-board">
            <BoardMap
              board={catalog.board}
              pinout={catalog.pinout}
              header={state.header}
              mounts={state.mounts || []}
              parts={catalog.parts}
              layers={{ components: true, pads: true, silk: true, pins: true, measurements: false }}
              selected={selection}
              onSelect={setSelection}
              chrome={false}
            />
          </div>
        ) : (
        <svg
          ref={svgRef}
          className="board-svg"
          viewBox={view ? `${view.x} ${view.y} ${view.w} ${view.h}` : "0 0 85 50"}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <rect className="bench-mat" x={-40} y={-40} width={160} height={120} />
          <rect className="pcb" x="0" y="0" width={boardW} height={boardH} rx={boardR} />
          {(state.mounts || []).map((mount) => {
            const part = catalog.parts.find((p) => p.id === mount.partId);
            if (!part?.dims) return null;
            return (
              <rect
                key={mount.id}
                className="mounted"
                x={mount.x_mm}
                y={mount.y_mm}
                width={part.dims.w_mm}
                height={part.dims.h_mm}
              />
            );
          })}
        </svg>
        )}
        {!compact && showEdgeLabel && <span className="edge-label across">{boardW} mm</span>}
        {!compact && showEdgeLabel && <span className="edge-label down">{boardH} mm</span>}
        {!compact && showCornerLabel && <span className="edge-label corner">r {boardR} mm · M2.5</span>}
        {!compact && <div className="scalebar" aria-label={t.scale}>
          <i style={{ width: `${bar * px}px` }} />
          <span>{bar} mm</span>
        </div>}
      </div>
      {!compact && (
        <aside className="bench-side">
          <HeaderSwitch state={state} onDispatch={onDispatch} t={t} />
          <BomList catalog={catalog} state={state} lang={lang} t={t} />
          <Tray groups={groups} lang={lang} t={t} onPick={(id) => setSelection({ kind: "part", id })} active={selection} />
        </aside>
      )}
    </div>
  );
}

function center(svgRef) {
  const el = svgRef.current;
  if (!el) return { x: 0, y: 0 };
  const rect = el.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

export function Tray({ groups, lang, t, onPick, active }) {
  return (
    <div className="tray">
      <h3>{t.tray}</h3>
      {groups.map(([category, parts]) => (
        <section key={category}>
          <h4>{category}</h4>
          <ul>
            {parts.map((part) => {
              const drawable = part.dims?.w_mm != null && part.dims?.h_mm != null && part.anchors?.length;
              return (
                <li key={part.id}>
                  <button
                    type="button"
                    className={active?.id === part.id ? "on" : ""}
                    onClick={() => onPick(part.id)}
                  >
                    <strong>{tx(part.name, lang)}</strong>
                    <em>{part.zero_w}</em>
                  </button>
                  {!drawable && <p>{t.trayOnly}. {tx(part.dims_note, lang) || t.notDrawn}</p>}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function groupParts(parts) {
  const groups = new Map();
  for (const part of parts) {
    const key = part.category || "other";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(part);
  }
  return [...groups.entries()];
}

export function HeaderSwitch({ state, onDispatch, t }) {
  return (
    <fieldset className="header-switch">
      <legend>{t.header}</legend>
      {["bare", "solder", "hammer"].map((method) => (
        <label key={method}>
          <input
            type="radio"
            name="header"
            checked={state.header === method}
            onChange={() => onDispatch({ type: "setHeader", method })}
          />
          {t[method]}
        </label>
      ))}
    </fieldset>
  );
}

export function BomList({ catalog, state, lang, t, approx = false }) {
  const bom = deriveBom(state, catalog);
  return (
    <section className="bom">
      <header>
        <h3>{approx ? t.approx : t.bom}</h3>
        <strong>{formatBom(bom)}</strong>
      </header>
      <ul>
        {bom.lines.map((line) => (
          <li key={line.partId}>
            <span>{tx(line.name, lang)}{line.qty > 1 ? ` × ${line.qty}` : ""}</span>
            <span>{line.price_usd == null ? t.unpriced : formatPrice(line)}</span>
          </li>
        ))}
      </ul>
      {bom.unpriced_count > 0 && <p className="unpriced-names">{bom.unpriced_names.join(", ")}</p>}
    </section>
  );
}
