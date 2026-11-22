import { useState } from "react";
import { tx, useLab } from "./state.jsx";
import { strings } from "./i18n.js";
import { BoardMap } from "./boardmap.jsx";
import { labCall } from "./lab.js";

export function Widget({ id }) {
  if (id === "board") return <BoardWidget />;
  if (id === "ohm-calculator") return <OhmWidget />;
  if (id === "logic-level") return <LogicWidget />;
  if (id === "gpio-sim") return <GpioWidget />;
  return null;
}

function BoardWidget() {
  const lab = useLab();
  return (
    <div className="lesson-board">
      <BoardMap
        board={lab.catalog.board}
        pinout={lab.catalog.pinout}
        header={lab.bench.header}
        mounts={lab.bench.mounts}
        parts={lab.catalog.parts}
        layers={{ components: true, pads: true, silk: true, pins: true, measurements: false }}
        selected={lab.selection}
        onSelect={lab.setSelection}
      />
    </div>
  );
}

async function postLab(tool, body) {
  return labCall(tool, body);
}

export function OhmWidget() {
  const { catalog, lang } = useLab();
  const t = strings(lang);
  const high = catalog.electrical.limits.gpio_high_v.value;
  const [vf, setVf] = useState("2.0");
  const [ma, setMa] = useState("8");
  const [volts, setVolts] = useState(String(high));
  const [count, setCount] = useState("1");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [fields, setFields] = useState({});

  async function run(event) {
    event.preventDefault();
    setError("");
    setResult(null);
    setFields({});
    try {
      const next = await postLab("resistor", { vf, i_ma: ma, v_gpio: volts, count });
      if (next?.ok === false) {
        setFields(next.fields || {});
        return;
      }
      setResult(next);
    } catch (err) {
      setResult(null);
      setError(String(err.message || err));
    }
  }

  return (
    <form className="widget" onSubmit={run}>
      <h3>{t.calc}</h3>
      <label>{t.vf}<input value={vf} onChange={(e) => setVf(e.target.value)} inputMode="decimal" />{fields.vf && <em className="warn">{t.fieldBad}</em>}</label>
      <label>{t.ma}<input value={ma} onChange={(e) => setMa(e.target.value)} inputMode="decimal" />{fields.ma && <em className="warn">{t.fieldBad}</em>}</label>
      <p className="note">{lang === "zh-CN" ? "入门目标：每颗 5–10 mA。" : "Beginner target: 5–10 mA per LED."}</p>
      <label>{t.volts}<input value={volts} onChange={(e) => setVolts(e.target.value)} inputMode="decimal" />{fields.volts && <em className="warn">{t.fieldBad}</em>}</label>
      <label>{t.count}<input value={count} onChange={(e) => setCount(e.target.value)} inputMode="numeric" />{fields.count && <em className="warn">{t.fieldBad}</em>}</label>
      <button type="submit">{t.run}</button>
      {error && <p className="warn">{error}</p>}
      {result && (
        <div className="result">
          <p>{result.ohms == null ? "—" : `${result.ohms} Ω`}</p>
          {result.e12_ohms != null && (
            <p>{result.e12_ohms} Ω E12 · {result.e12_ma} mA {lang === "zh-CN" ? "每颗" : "per LED"}</p>
          )}
          {result.per_led && <p>{result.per_led[lang] || result.per_led.en}</p>}
          {result.sag && <p>{result.sag[lang] || result.sag.en}</p>}
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
    if (pin.physical === 27 || pin.physical === 28) {
      setHit({
        bad: true,
        text: lang === "zh-CN"
          ? "引脚 27 和 28 留给 HAT 的 ID EEPROM（ID_SD / ID_SC）。"
          : "Pins 27 and 28 are reserved for the HAT ID EEPROM (ID_SD / ID_SC).",
      });
    } else if (pin.kind === "gpio") {
      setHit({
        bad: true,
        text: lang === "zh-CN"
          ? "5 V 高于这只脚所接的 3.3 V 电源，也超出额定范围，可能永久损坏 SoC。"
          : "5 V is above the 3.3 V supply the pin runs from and outside its rated range; it can permanently damage the SoC.",
      });
    } else if (pin.name === "5V") {
      setHit({
        bad: false,
        text: lang === "zh-CN"
          ? "引脚 2 和 4 是 5 V 电源，不是逻辑输入。"
          : "Pins 2 and 4 are 5 V power. They are not logic inputs.",
      });
    } else if (pin.name === "3V3") {
      setHit({
        bad: true,
        text: lang === "zh-CN"
          ? "引脚 1 和 17 的 3V3 来自板上的 3.3 V 稳压器。不要用它们给大负载供电，也不要灌入 5 V。"
          : "Pins 1 and 17 are the board's 3.3 V regulator output. Do not power a big load from them, and do not feed 5 V into them.",
      });
    } else {
      setHit({
        bad: true,
        text: lang === "zh-CN"
          ? "地是 0 V，不是 5 V 的去处。"
          : "Ground is 0 V. It is not a place for 5 V.",
      });
    }
  }

  return (
    <div className="widget">
      <p className="note">
        {lang === "zh-CN"
          ? "这是排针的逻辑顺序，不是 PCB 上的比例位置。"
          : "Logical header order, not a scaled placement on the PCB."}
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
      {pin.alt_matrix && (
        <ul>
          {Object.entries(pin.alt_matrix).map(([alt, name]) => (
            <li key={alt}><b>{alt}</b> {name}</li>
          ))}
        </ul>
      )}
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
    const shown = typeof kw.bounce_ms === "number" ? kw.bounce_ms : debounce;
    if (typeof kw.bounce_ms === "number") setDebounce(shown);
    const clampNote = kw.bounce_clamped
      ? (lang === "zh-CN" ? `已按模型上限记为 ${shown} ms。` : `Clamped to ${shown} ms.`)
      : "";
    setNote(`${lang === "zh-CN" ? "已读出调用。gpiozero 的 bounce_time 填进模型的 debounce。" : "Call read. gpiozero bounce_time feeds the model debounce."} ${clampNote}`.trim());
    await run({
      pull: kw.pull_up === false ? "down" : "up",
      debounce_ms: shown,
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
