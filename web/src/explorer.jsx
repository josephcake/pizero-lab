import { useEffect, useMemo, useState } from "react";
import { canMount, deriveBom, formatBom } from "../../shared/bench.mjs";
import { fitsBoard } from "../../shared/boards.mjs";
import { strings } from "./i18n.js";
import { tx, useLab } from "./state.jsx";
import { BoardMap, Minimap } from "./boardmap.jsx";
import { BomList } from "./workbench.jsx";

const LAYERS = [
  ["components", "Components"],
  ["pads", "Pads & holes"],
  ["silk", "Silkscreen"],
  ["pins", "Pin functions"],
  ["measurements", "Measurements"],
];

export function Explorer() {
  const lab = useLab();
  const t = strings(lab.lang);
  const board = lab.catalog.board;
  const [layers, setLayers] = useState({ components: true, pads: true, silk: true, pins: true, measurements: false });
  const [view, setView] = useState(null);
  const [mountNote, setMountNote] = useState("");
  const [conflicts, setConflicts] = useState(null);
  const hats = lab.catalog.parts.filter((part) => fitsBoard(part, board.id) && part.product_url);
  const mountedIds = lab.bench.jobPartIds.filter((id) => hats.some((hat) => hat.id === id));

  useEffect(() => {
    if (mountedIds.length < 2) {
      setConflicts({ conflicts: [] });
      return;
    }
    fetch("/api/lab/conflicts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ part_ids: mountedIds, board: board.id }),
    })
      .then((r) => r.json())
      .then(setConflicts)
      .catch(() => setConflicts(null));
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
        const response = await fetch("/api/lab/conflicts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ part_ids: ids, board: board.id }),
        });
        const data = await response.json();
        setConflicts(data);
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

  return (
    <div className="explorer">
      <aside className="rail">
        <p className="overline">Layers</p>
        {LAYERS.map(([id, label]) => (
          <label key={id} className="layer">
            <input type="checkbox" checked={!!layers[id]} onChange={() => toggleLayer(id)} />
            {label}
          </label>
        ))}
        <p className="overline">Legend</p>
        <ul className="legend">
          {legend.map((row) => (
            <li key={row.id}><i style={{ background: row.ink }} />{row.label}<b>{row.count}</b></li>
          ))}
        </ul>
        <p className="overline">{t.header}</p>
        <div className="seg">
          {["bare", "solder", "hammer"].map((method) => (
            <button key={method} type="button" className={lab.bench.header === method ? "on" : ""} onClick={() => lab.dispatch({ type: "setHeader", method })}>
              {t[method]}
            </button>
          ))}
        </div>
        <p className="overline">{t.tray}</p>
        <ul className="tray-list">
          {hats.filter((hat) => hat.dims).slice(0, 8).map((hat) => (
            <li key={hat.id}>
              <button type="button" onClick={() => fitPart(hat)}>{tx(hat.name, lab.lang)}</button>
            </li>
          ))}
        </ul>
        {mountNote && <p className="warn">{mountNote}</p>}
      </aside>
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
        />
        <div className="map-foot">
          <div>
            <span className="scale-foot"><i />10 mm</span>
            <p className="bill-line">{t.bom} {formatBom(deriveBom(lab.bench, lab.catalog))}</p>
            <BomList catalog={lab.catalog} state={lab.bench} lang={lab.lang} t={t} />
          </div>
          <Minimap board={board} view={view} />
        </div>
      </div>
      <aside className="inspector">
        <p className="overline">Inspector</p>
        {!selectedPin && !selectedPart && <p className="quiet">Click any part of the board.</p>}
        {selectedPin && <PinInspector pin={selectedPin} />}
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
    ["5V", "5V power", "var(--ov-5v)", (p) => p.name === "5V"],
    ["3V3", "3V3 power", "var(--ov-3v3)", (p) => p.name === "3V3"],
    ["GND", "Ground", "var(--ov-gnd)", (p) => p.name === "GND"],
    ["GPIO", "GPIO", "var(--ov-gpio)", (p) => p.type === "gpio" || p.kind === "gpio"],
  ];
  return rows.map(([id, label, ink, test]) => ({ id, label, ink, count: pins.filter(test).length }));
}

function PinInspector({ pin }) {
  const sources = pin.src || [];
  return (
    <article>
      <h2>Pin {pin.physical} · {pin.name}</h2>
      <dl className="facts">
        <div><dt>Physical</dt><dd>{pin.physical}</dd></div>
        <div><dt>BCM</dt><dd>{pin.bcm ?? "—"}</dd></div>
        <div><dt>Name</dt><dd>{pin.name}</dd></div>
        <div><dt>Pull</dt><dd>{pin.default_pull || "—"}</dd></div>
      </dl>
      {pin.note && <p>{pin.note}</p>}
      <p className="overline">Alternate functions</p>
      <ul className="alts">
        {Object.entries(pin.alt_matrix || {}).map(([alt, name]) => <li key={alt}><b>{alt}</b> {name}</li>)}
        {Object.keys(pin.alt_matrix || {}).length === 0 && <li>none</li>}
      </ul>
      <p className="overline">Sources ({sources.length})</p>
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
