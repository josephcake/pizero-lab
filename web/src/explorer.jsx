import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { canMount } from "../../shared/bench.mjs";
import { fitsBoard } from "../../shared/boards.mjs";
import { strings } from "./i18n.js";
import { labCall } from "./lab.js";
import { tx, useLab } from "./state.jsx";
import { BoardMap, Minimap } from "./boardmap.jsx";

const Board3D = lazy(() => import("./board3d.jsx"));

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
  const [params, setParams] = useSearchParams();
  const is3d = params.get("view") === "3d";
  function setProjection(next) {
    const query = new URLSearchParams(params);
    if (next === "3d") query.set("view", "3d");
    else query.delete("view");
    setParams(query, { replace: true });
  }
  const viewToggle = (
    <div className="seg view-toggle" role="group" aria-label={t.view}>
      <button type="button" className={is3d ? "" : "on"} onClick={() => setProjection("2d")}>{t.view2d}</button>
      <button type="button" className={is3d ? "on" : ""} onClick={() => setProjection("3d")}>{t.view3d}</button>
    </div>
  );
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
    ? findRecord(board.components, lab.selection.id)
    : lab.selection?.kind === "part"
      ? lab.catalog.parts.find((item) => item.id === lab.selection.id)
      : null;
  const showUnderside = lab.selection?.kind === "underside";

  useEffect(() => {
    if (showUnderside) setSnap("full");
  }, [showUnderside]);

  const rail = (
    <>
      <label className="sheet-picker">
        {t.picker}
        <select aria-label={t.picker} value={lab.catalog.modelId} onChange={(event) => lab.pickBoard(event.target.value)}>
          {lab.catalog.boards.base.models.map((model) => {
            const live = Boolean(lab.catalog.boards.models[model.id]);
            const short = { "zero-v1.2": "Zero v1.2", "zero-v1.3": "Zero v1.3", "zero-w": "Zero W", "zero-wh": "Zero WH", "zero-2-w": "Zero 2 W", "zero-2-wh": "Zero 2 WH" }[model.id] || model.id;
            return <option key={model.id} value={model.id} disabled={!live}>{short}{live ? "" : ` · ${t.coming}`}</option>;
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
          <button type="button" className="text-btn" onClick={() => lab.setSelection({ kind: "component", id: "pcb-antenna" })}>{t.antenna}</button>
          <ul className="legend">
            {legend.map((row) => (
              <li key={row.id}><i style={{ background: row.ink }} />{t[row.label]}<b>{row.count}</b></li>
            ))}
            {board.header?.padEstimate && (
              <li>{t.padDrill} {board.header.padD.toFixed(1)} / {board.header.drillD.toFixed(1)} mm <span className="est">{t.est}</span></li>
            )}
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
        {is3d ? (
          <Suspense fallback={<div className="map-wrap board-3d-stage"><p className="estimate-note">{t.loading}</p></div>}>
            <Board3D
              board={board}
              pinout={lab.catalog.pinout}
              header={lab.bench.header}
              mounts={lab.bench.mounts}
              parts={lab.catalog.parts}
              selected={lab.selection}
              onSelect={lab.setSelection}
              labels={t}
              viewToggle={viewToggle}
              onOpenLayers={() => setSheet(true)}
            />
          </Suspense>
        ) : (
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
            viewToggle={viewToggle}
          />
        )}
        {sheet && (
          <>
            <button type="button" className="sheet-backdrop" aria-label={t.close} onClick={() => setSheet(false)} />
            <div className="layers-sheet" role="dialog" aria-label={t.layers}>
              {rail}
            </div>
          </>
        )}
        {!is3d && (
          <div className="map-foot">
            <span className="scale-foot"><i style={{ width: `${Math.max(0, (([1, 2, 5, 10, 20].find((step) => step * (view?.px || 0) >= 60) ?? 20) * (view?.px || 0)))}px` }} />{[1, 2, 5, 10, 20].find((step) => step * (view?.px || 0) >= 60) ?? 20} mm <span className="readout">{(view?.px || 0).toFixed(1)} px/mm</span></span>
            <Minimap board={board} view={view} mounts={lab.bench.mounts} parts={lab.catalog.parts} />
          </div>
        )}
      </div>
      <aside className={`inspector snap-${snap}`}>
        <button type="button" className="snap-handle" onClick={() => setSnap((value) => value === "peek" ? "half" : value === "half" ? "full" : "peek")} />
        <p className="overline">{t.inspector}</p>
        {!selectedPin && !selectedPart && !showUnderside && <p className="quiet">{t.inspectEmpty}</p>}
        {selectedPin && <PinInspector pin={selectedPin} header={board.header} />}
        {selectedPart && <PartInspector part={selectedPart} lang={lab.lang} />}
        {showUnderside && <UndersideInspector board={board} lang={lab.lang} />}
      </aside>
    </div>
  );
}

function findRecord(components, id) {
  for (const item of components || []) {
    if (item.id === id) return item;
    const sub = (item.subparts || []).find((row) => row.id === id);
    if (sub) return sub;
  }
  return null;
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

function textOf(lang, translated, recorded) {
  return lang === "zh-CN" ? translated : recorded;
}

function SourceList({ sources }) {
  if (!sources?.length) return null;
  return (
    <ul className="sources">
      {sources.map((src) => (
        <li key={src.url}><a href={src.url}>{src.doc ? `${src.doc} — ${src.section}` : src.section || src.url}</a></li>
      ))}
    </ul>
  );
}

function UndersideInspector({ board, lang }) {
  const t = strings(lang);
  const pads = (board.components || []).find((item) => item.id === "test-pads");
  const doc = board.underside || {};
  const rows = pads?.subparts || [];
  return (
    <article className="underside">
      <h2>{t.underside}</h2>
      <p className="overline">{t.testPads}</p>
      <ul className="pad-list">
        {rows.map((row) => {
          const src = row.src?.[0];
          return (
            <li key={row.id}>
              <b>{row.id}</b>
              <span>{row.net}</span>
              {src && <a href={src.url}>{src.doc || src.section}</a>}
            </li>
          );
        })}
      </ul>
      <p>{textOf(lang, t.undersideParts, doc.parts?.text)}</p>
      <SourceList sources={doc.parts?.src} />
      <p>
        {textOf(lang, t.undersideJ5, doc.footprint?.text)}{" "}
        <span className="est">{t.derived}</span>
      </p>
      <ol className="pin-nets">
        {(doc.footprint?.pins || []).map((pin) => (
          <li key={pin.pin}><b>{pin.pin}</b> {pin.net}</li>
        ))}
      </ol>
      <SourceList sources={doc.footprint?.src} />
      <p className="overline">{t.undersidePrint}</p>
      <ul className="print-list">
        {(doc.print?.lines || []).map((line) => <li key={line}>{line}</li>)}
      </ul>
      <p>{textOf(lang, t.undersideVersions, doc.print?.versions)}</p>
      <SourceList sources={doc.print?.src} />
    </article>
  );
}

function PartInspector({ part, lang }) {
  const srcs = part.src || [];
  return (
    <article>
      <h2>{typeof part.name === "string" ? part.name : tx(part.name, lang)}</h2>
      {part.function && <p>{part.function}</p>}
      {part.note && <p>{part.note}</p>}
      {part.summary && <p>{tx(part.summary, lang)}</p>}
      {part.gotchas && <p className="warn">{part.gotchas}</p>}
      {part.x_mm == null && part.dims == null && <p className="quiet">Not drawn. Position or size is null.</p>}
      <ul className="sources">
        {srcs.map((src) => <li key={src.url || src}><a href={src.url || src}>{src.section || src.url || src}</a></li>)}
      </ul>
    </article>
  );
}
