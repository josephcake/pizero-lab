import { useState } from "react";
import { tx, useLab } from "./state.jsx";
import { strings } from "./i18n.js";
import { Workbench } from "./workbench.jsx";

export function Widget({ id }) {
  if (id === "board") return <BoardWidget />;
  if (id === "ohm-calculator") return <OhmWidget />;
  if (id === "logic-level") return <LogicWidget />;
  if (id === "gpio-sim") return <GpioWidget />;
  return null;
}

function BoardWidget() {
  const { bench, dispatch } = useLab();
  return <Workbench state={bench} onDispatch={dispatch} compact />;
}

async function postLab(tool, body) {
  const response = await fetch(`/api/lab/${tool}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "lab");
  return data;
}

function OhmWidget() {
  const { catalog, lang } = useLab();
  const t = strings(lang);
  const high = catalog.electrical.limits.gpio_high_v.value;
  const [vf, setVf] = useState("2.0");
  const [ma, setMa] = useState("10");
  const [volts, setVolts] = useState(String(high));
  const [count, setCount] = useState("1");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function run(event) {
    event.preventDefault();
    setError("");
    try {
      setResult(await postLab("resistor", {
        vf: Number(vf),
        i_ma: Number(ma),
        v_gpio: Number(volts),
        count: Number(count),
      }));
    } catch (err) {
      setError(String(err.message || err));
    }
  }

  return (
    <form className="widget" onSubmit={run}>
      <h3>{t.calc}</h3>
      <label>{t.vf}<input value={vf} onChange={(e) => setVf(e.target.value)} inputMode="decimal" /></label>
      <label>{t.ma}<input value={ma} onChange={(e) => setMa(e.target.value)} inputMode="decimal" /></label>
      <label>{t.volts}<input value={volts} onChange={(e) => setVolts(e.target.value)} inputMode="decimal" /></label>
      <label>{t.count}<input value={count} onChange={(e) => setCount(e.target.value)} inputMode="numeric" /></label>
      <button type="submit">{t.run}</button>
      {error && <p className="warn">{error}</p>}
      {result && (
        <div className="result">
          <p>{result.ohms == null ? "—" : `${result.ohms} Ω`}</p>
          <p className="formula">{result.formula}</p>
          <ul>
            {(result.warnings || []).map((w) => <li key={w.code}>{w[lang] || w.en}</li>)}
          </ul>
        </div>
      )}
    </form>
  );
}

function LogicWidget() {
  const { catalog, lang, setSelection, selection } = useLab();
  const t = strings(lang);
  const [hit, setHit] = useState(null);
  const pins = catalog.pinout.pins;
  const odds = pins.filter((p) => p.physical % 2 === 1);
  const evens = pins.filter((p) => p.physical % 2 === 0);

  function drive() {
    const pin = pins.find((p) => p.physical === selection?.physical);
    if (!pin) return;
    if (pin.kind === "gpio") {
      setHit({
        bad: true,
        text: lang === "es"
          ? "La página GPIO dice que 5 V en un GPIO pueden dañar el SoC de forma permanente. Este pin no es de 5 V."
          : "The GPIO page says 5 V on a GPIO can permanently damage the SoC. This pin is not a 5 V pin.",
      });
    } else if (pin.name === "5V") {
      setHit({
        bad: false,
        text: lang === "es"
          ? "Los pines 2 y 4 son alimentación de 5 V. No son entradas lógicas."
          : "Pins 2 and 4 are 5 V power. They are not logic inputs.",
      });
    } else if (pin.name === "3V3") {
      setHit({
        bad: true,
        text: lang === "es"
          ? "Este pin es la salida de 3,3 V. Ponerle 5 V no es un nivel lógico y no está autorizado por la página GPIO."
          : "This pin is the 3.3 V output. Putting 5 V on it is not a logic level, and the GPIO page does not allow it.",
      });
    } else {
      setHit({
        bad: true,
        text: lang === "es"
          ? "Masa es 0 V. No es un sitio para 5 V."
          : "Ground is 0 V. It is not a place for 5 V.",
      });
    }
  }

  return (
    <div className="widget">
      <p className="note">
        {lang === "es"
          ? "Orden lógico del header, no una posición a escala sobre la PCB. Las coordenadas de los taladros son nulas."
          : "Logical header order, not a scaled placement on the PCB. Hole coordinates are null."}
      </p>
      <div className="pin-grid">
        <ol>
          {odds.map((pin) => (
            <li key={pin.physical}>
              <button type="button" className={selection?.physical === pin.physical ? "on" : pin.kind} onClick={() => { setSelection({ kind: "pin", physical: pin.physical }); setHit(null); }}>
                <b>{pin.physical}</b> {pin.name}
              </button>
            </li>
          ))}
        </ol>
        <ol>
          {evens.map((pin) => (
            <li key={pin.physical}>
              <button type="button" className={selection?.physical === pin.physical ? "on" : pin.kind} onClick={() => { setSelection({ kind: "pin", physical: pin.physical }); setHit(null); }}>
                <b>{pin.physical}</b> {pin.name}
              </button>
            </li>
          ))}
        </ol>
      </div>
      <button type="button" onClick={drive} disabled={selection?.kind !== "pin"}>{t.drive}</button>
      {hit && <p className={hit.bad ? "warn" : "ok"}>{hit.text}</p>}
      {selection?.kind === "pin" && <PinFacts physical={selection.physical} />}
    </div>
  );
}

export function PinFacts({ physical }) {
  const { catalog, lang } = useLab();
  const pin = catalog.pinout.pins.find((p) => p.physical === Number(physical));
  if (!pin) return null;
  const source = catalog.sources[pin.source];
  return (
    <article className="record">
      <h3>Pin {pin.physical} · {pin.name}</h3>
      <p>{pin.bcm == null ? pin.kind : `BCM ${pin.bcm}`}</p>
      <ul>{pin.typical_functions.map((fn) => <li key={fn}>{fn}</li>)}</ul>
      {pin.typical_functions.length === 0 && <p>{strings(lang).unknown}</p>}
      <p className="note">{pin.alt_matrix_note}</p>
      {source && <a href={source.url}>{source.title}</a>}
    </article>
  );
}

function GpioWidget() {
  const { lang } = useLab();
  const t = strings(lang);
  const [pull, setPull] = useState("up");
  const [bounce, setBounce] = useState(8);
  const [debounce, setDebounce] = useState(15);
  const [trace, setTrace] = useState(null);
  const [code, setCode] = useState("button = Button(27, pull_up=True, bounce_time=0.02)");
  const [note, setNote] = useState("");

  async function run(next = {}) {
    const body = { pull, bounce_ms: bounce, debounce_ms: debounce, press_at_ms: 180, release_at_ms: 460, duration_ms: 700, ...next };
    setTrace(await postLab("gpio", body));
  }

  async function readCode(event) {
    event.preventDefault();
    const parsed = await postLab("button", { code });
    if (!parsed.ok) {
      setNote(parsed.error);
      return;
    }
    const kw = parsed.kwargs || {};
    if (typeof kw.pull_up === "boolean") setPull(kw.pull_up ? "up" : "down");
    if (typeof kw.bounce_time === "number") setDebounce(Math.round(kw.bounce_time * 1000));
    setNote(lang === "es" ? "Llamada leída. bounce_time de gpiozero pasa al debounce del modelo." : "Call read. gpiozero bounce_time feeds the model debounce.");
    await run({
      pull: kw.pull_up === false ? "down" : "up",
      debounce_ms: typeof kw.bounce_time === "number" ? Math.round(kw.bounce_time * 1000) : debounce,
    });
  }

  return (
    <div className="widget">
      <div className="row">
        <label>{t.pull}
          <select value={pull} onChange={(e) => setPull(e.target.value)}>
            <option value="up">pull-up</option>
            <option value="down">pull-down</option>
          </select>
        </label>
        <label>{t.bounce}<input type="range" min="0" max="30" value={bounce} onChange={(e) => setBounce(Number(e.target.value))} /> <b>{bounce}</b></label>
        <label>{t.debounce}<input type="range" min="0" max="60" value={debounce} onChange={(e) => setDebounce(Number(e.target.value))} /> <b>{debounce}</b></label>
        <button type="button" onClick={() => run()}>{t.run}</button>
      </div>
      {trace && <Trace samples={trace.samples} />}
      <form onSubmit={readCode} className="codebox">
        <label>{t.code}<textarea value={code} onChange={(e) => setCode(e.target.value)} rows={3} spellCheck={false} /></label>
        <button type="submit">{t.readCode}</button>
        {note && <p>{note}</p>}
      </form>
    </div>
  );
}

function Trace({ samples }) {
  const w = 640;
  const h = 120;
  const last = samples[samples.length - 1]?.t || 1;
  const path = (key, y0) => samples.map((s, i) => {
    const x = (s.t / last) * (w - 16) + 8;
    const y = y0 - s[key] * 36;
    return `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg className="trace" viewBox={`0 0 ${w} ${h}`} role="img">
      <text x="8" y="16">raw</text>
      <text x="8" y="70">debounced</text>
      <path d={path("raw", 40)} />
      <path d={path("debounced", 96)} className="deb" />
    </svg>
  );
}

export function Markdown({ text }) {
  const blocks = String(text || "").split(/\n\n+/);
  return (
    <div className="prose">
      {blocks.map((block, index) => <p key={index}>{inline(block)}</p>)}
    </div>
  );
}

function inline(text) {
  const bits = text.split(/(`[^`]+`)/g);
  return bits.map((bit, i) => bit.startsWith("`") ? <code key={i}>{bit.slice(1, -1)}</code> : bit);
}
