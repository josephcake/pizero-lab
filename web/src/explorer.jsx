import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { canMount } from "../../shared/bench.mjs";
import { fitsBoard } from "../../shared/boards.mjs";
import { strings } from "./i18n.js";
import { labCall } from "./lab.js";
import { tx, useLab } from "./state.jsx";
import { BoardMap, Minimap } from "./boardmap.jsx";

const LAYERS = [
  ["components", "layerComponents", "var(--ov-gpio)"],
  ["pads", "layerPads", "var(--ov-3v3)"],
  ["silk", "layerSilk", "#f2efe4"],
  ["pins", "layerPins", "var(--ov-i2c)"],
  ["measurements", "layerMeasure", "var(--ov-ghost)"],
];

export function Explorer() {
  const lab = useLab();
  const t = strings(lab.lang);
  const board = lab.catalog.board;
  const [layers, setLayers] = useState({ components: true, pads: true, silk: true, pins: true, measurements: false });
  const [view, setView] = useState(null);
  const [mountNote, setMountNote] = useState("");
  const [conflicts, setConflicts] = useState(null);
  const [sheet, setSheet] = useState(false);
  const [mode, setMode] = useState("explore");
  const [snap, setSnap] = useState("peek");
  const hats = lab.catalog.parts.filter((part) => fitsBoard(part, board.id) && part.product_url);
  const mountedIds = lab.bench.jobPartIds.filter((id) => hats.some((hat) => hat.id === id));

  useEffect(() => {
    if (mountedIds.length < 2) {
      setConflicts({ conflicts: [] });
      return;
    }
    try {
      setConflicts(labCall("conflicts", { part_ids: mountedIds, board: board.id }, lab.catalog));
    } catch {
      setConflicts(null);
    }
  }, [mountedIds.join("|"), board.id]);

  function toggleLayer(id) {
    setLayers((current) => ({ ...current, [id]: !current[id] }));
  }

  async function fitPart(part) {
    const check = canMount(lab.bench, lab.catalog, {
      partId: part.id,
      hostRef: "board",
      hostAnchorId: "gpio-pin1",
      partAnchorId: "pin1",
    });
    if (!check.ok) {
      if (check.code === "occupied" || check.code === "needs-header") {
        const ids = [...new Set([...lab.bench.jobPartIds, part.id])];
        setConflicts(labCall("conflicts", { part_ids: ids, board: board.id }, lab.catalog));
      }
      setMountNote(check.code === "needs-header"
        ? (lab.lang === "zh-CN" ? "需要先焊接或压接排针。" : "Needs a soldered or hammer header.")
        : (lab.lang === "zh-CN" ? "这个排针已经被占用。" : "That header is already occupied."));
      return;
    }
    lab.dispatch({ type: "mount", partId: part.id, hostRef: "board", hostAnchorId: "gpio-pin1", partAnchorId: "pin1" });
    setMountNote("");
  }

  const legend = useMemo(() => countLegend(lab.catalog.pinout.pins), [lab.catalog.pinout]);
  const selectedPin = lab.selection?.kind === "pin"
    ? lab.catalog.pinout.pins.find((pin) => pin.physical === lab.selection.physical)
    : null;
  const selectedPart = lab.selection?.kind === "component"
    ? board.components.find((item) => item.id === lab.selection.id)
    : lab.selection?.kind === "part"
      ? lab.catalog.parts.find((item) => item.id === lab.selection.id)
      : null;

  const rail = (
    <>
      <label className="sheet-picker">
        {t.picker}
        <select aria-label={t.picker} value={lab.catalog.modelId} onChange={(event) => lab.pickBoard(event.target.value)}>
          {lab.catalog.boards.base.models.map((model) => {
            const live = Boolean(lab.catalog.boards.models[model.id]);
            return <option key={model.id} value={model.id} disabled={!live}>{model.name?.[lab.lang] || model.name?.en || model.id}{live ? "" : ` · ${t.coming}`}</option>;
          })}
        </select>
      </label>
      <p className="overline">{t.header}</p>
      <div className="seg">
        {[["bare", "bareShort"], ["solder", "solderShort"], ["hammer", "hammerShort"]].map(([method, key]) => (
          <button key={method} type="button" className={lab.bench.header === method ? "on" : ""} onClick={() => lab.dispatch({ type: "setHeader", method })}>
            {t[key]}
          </button>
        ))}
      </div>
      {mode === "explore" && (
        <>
          <p className="overline">{t.layers}</p>
          {LAYERS.map(([id, key, ink]) => (
            <div key={id} className="layer">
              <button type="button" className="eye" aria-pressed={!!layers[id]} onClick={() => toggleLayer(id)}>{layers[id] ? "◉" : "○"}</button>
              <i className="swatch" style={{ background: ink }} />
              <span>{t[key]}</span>
              <b>{id === "pads" || id === "pins" ? lab.catalog.pinout.pins.length : id === "measurements" ? 2 : board.draw.length}</b>
            </div>
          ))}
          <p className="overline">{t.legend}</p>
          <ul className="legend">
            {legend.map((row) => (
              <li key={row.id}><i style={{ background: row.ink }} />{t[row.label]}<b>{row.count}</b></li>
            ))}
          </ul>
        </>
      )}
      <p className="bench-caption">
        {lab.bench.mounts.length ? t.benchMounted : lab.bench.header === "bare" ? t.benchBare : lab.bench.header === "hammer" ? t.benchHammer : t.benchSolder}
        {" "}<span className="provisional">{t.provisional}</span>
      </p>
      {mode === "bench" && (
        <>
          <button type="button" onClick={() => { const hat = hats.find((item) => item.dims); if (hat) fitPart(hat); }}>{t.fitHat}</button>
          <ul className="tray-list">
            {hats.filter((hat) => hat.dims).slice(0, 8).map((hat) => (
              <li key={hat.id}>
                <Link to={`/parts/${hat.id}`}>{tx(hat.name, lab.lang).replaceAll("-", "\u2011")}</Link>
              </li>
            ))}
          </ul>
        </>
      )}
      {mountNote && <p className="warn">{mountNote}</p>}
    </>
  );

  return (
    <div className="explorer">
      <aside className="rail">{rail}</aside>
      <div className="map-column">
        {conflicts?.conflicts?.length > 0 && (
          <p className="conflict" role="alert">
            {conflicts.conflicts.map((row) => `${nameOf(row.names[0])} ∩ ${nameOf(row.names[1])}: pins ${row.pins.join(", ")}`).join(" · ")}
          </p>
        )}
        <BoardMap
          board={board}
          pinout={lab.catalog.pinout}
          header={lab.bench.header}
          mounts={lab.bench.mounts}
          parts={lab.catalog.parts}
          layers={layers}
          selected={lab.selection}
          onSelect={lab.setSelection}
          onView={setView}
          onOpenLayers={() => setSheet(true)}
          mode={mode}
          onMode={setMode}
          onMeasure={() => toggleLayer("measurements")}
        />
        {sheet && (
          <>
            <button type="button" className="sheet-backdrop" aria-label={t.close} onClick={() => setSheet(false)} />
            <div className="layers-sheet" role="dialog" aria-label={t.layers}>
              {rail}
            </div>
          </>
        )}
        <div className="map-foot">
          <span className="scale-foot"><i style={{ width: `${Math.max(0, 10 * (view?.px || 0))}px` }} />10 mm <span className="readout">{(view?.px || 0).toFixed(1)} px/mm</span></span>
          <Minimap board={board} view={view} mounts={lab.bench.mounts} parts={lab.catalog.parts} />
        </div>
      </div>
      <aside className={`inspector snap-${snap}`}>
        <button type="button" className="snap-handle" onClick={() => setSnap((value) => value === "peek" ? "half" : value === "half" ? "full" : "peek")} />
        <p className="overline">{t.inspector}</p>
        {!selectedPin && !selectedPart && <p className="quiet">{t.inspectEmpty}</p>}
        {selectedPin && <PinInspector pin={selectedPin} header={board.header} />}
        {selectedPart && <PartInspector part={selectedPart} lang={lab.lang} />}
      </aside>
    </div>
  );
}

function nameOf(value) {
  if (!value) return "";
  return typeof value === "string" ? value : value.en || "";
}

function countLegend(pins) {
  const rows = [
    ["5V", "leg5v", "var(--ov-5v)", (p) => p.name === "5V"],
    ["3V3", "leg3v3", "var(--ov-3v3)", (p) => p.name === "3V3"],
    ["GND", "legGnd", "var(--ov-gnd)", (p) => p.name === "GND"],
    ["GPIO", "legGpio", "var(--ov-gpio)", (p) => (p.type === "gpio" || p.kind === "gpio") && p.physical !== 27 && p.physical !== 28],
    ["ID", "legId", "var(--ov-id)", (p) => p.physical === 27 || p.physical === 28],
  ];
  return rows.map(([id, label, ink, test]) => ({ id, label, ink, count: pins.filter(test).length }));
}

function PinInspector({ pin, header }) {
  const t = strings(useLab().lang);
  const sources = pin.src || [];
  return (
    <article>
      <h2>Pin {pin.physical} · {pin.name}</h2>
      <dl className="facts">
        <div><dt>{t.physical}</dt><dd>{pin.physical}</dd></div>
        <div><dt>{t.bcm}</dt><dd>{pin.bcm ?? "—"}</dd></div>
        <div><dt>{t.nameLabel}</dt><dd>{pin.name}</dd></div>
        <div><dt>{t.pullLabel}</dt><dd>{pin.default_pull || "—"}</dd></div>
        {header?.padEstimate && (
          <div><dt>{t.padDrill}</dt><dd>{header.padD.toFixed(1)} / {header.drillD.toFixed(1)} mm <span className="est">{t.est}</span></dd></div>
        )}
      </dl>
      {pin.note && <p>{pin.note}</p>}
      <p className="overline">{t.alts}</p>
      <ul className="alts">
        {Object.entries(pin.alt_matrix || {}).map(([alt, name]) => <li key={alt}><b>{alt}</b> {name}</li>)}
        {Object.keys(pin.alt_matrix || {}).length === 0 && <li>{t.none}</li>}
      </ul>
      <p className="overline">{t.sources} ({sources.length})</p>
      <ul className="sources">
        {sources.map((src) => (
          <li key={src.url}><a href={src.url}>{src.section || src.url}</a></li>
        ))}
      </ul>
    </article>
  );
}

function PartInspector({ part, lang }) {
  const srcs = part.src || [];
  return (
    <article>
      <h2>{typeof part.name === "string" ? part.name : tx(part.name, lang)}</h2>
      {part.function && <p>{part.function}</p>}
      {part.summary && <p>{tx(part.summary, lang)}</p>}
      {part.gotchas && <p className="warn">{part.gotchas}</p>}
      {part.x_mm == null && part.dims == null && <p className="quiet">Not drawn. Position or size is null.</p>}
      <ul className="sources">
        {srcs.map((src) => <li key={src.url || src}><a href={src.url || src}>{src.section || src.url || src}</a></li>)}
      </ul>
    </article>
  );
}
