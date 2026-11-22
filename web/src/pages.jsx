import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { replaySteps } from "../../shared/bench.mjs";
import { fitsBoard, mismatch } from "../../shared/boards.mjs";
import { strings } from "./i18n.js";
import { labCall } from "./lab.js";
import { defaultModel, forgetCredentials, notifyKeyChange, readCredentials, writeCredentials } from "./help.jsx";
import { tx, useLab } from "./state.jsx";
import { Workbench, BomList } from "./workbench.jsx";
import { Explorer } from "./explorer.jsx";
import { Markdown, OhmWidget, PinFacts, Widget } from "./widgets.jsx";

export function BoardPage() {
  const { id } = useParams();
  const lab = useLab();
  const t = strings(lab.lang);
  const component = id ? lab.catalog.board.components.find((c) => c.id === id) : null;

  useEffect(() => {
    lab.setStep(null);
    if (component) lab.setSelection({ kind: "component", id: component.id });
  }, [id]);

  return <Explorer />;
}

function ComponentIndex() {
  const { catalog, lang } = useLab();
  const roots = catalog.board.components.filter((c) => !c.parent);
  return (
    <ul className="index">
      {roots.map((c) => (
        <li key={c.id}>
          <Link to={`/board/${c.id}`}>{tx(c.name, lang)}</Link>
          <ul>
            {catalog.board.components.filter((child) => child.parent === c.id).map((child) => (
              <li key={child.id}><Link to={`/board/${child.id}`}>{tx(child.name, lang)}</Link></li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

function ComponentCard({ component }) {
  const { catalog, lang } = useLab();
  const source = catalog.sources[component.source];
  const children = catalog.board.components.filter((c) => c.parent === component.id);
  return (
    <article className="record">
      <h2>{tx(component.name, lang)}</h2>
      <p>{tx(component.summary, lang)}</p>
      {component.placement == null && <p className="note">{strings(lang).notDrawn}</p>}
      <ul>
        {(component.facts || []).map((fact) => (
          <li key={fact.id}>
            <b>{fact.id}</b>{" "}
            {fact.value == null ? strings(lang).unknown : String(fact.value)}
            {fact.estimate ? <span className="est">{strings(lang).est}</span> : null}
            {fact.note ? ` — ${fact.note}` : ""}
          </li>
        ))}
      </ul>
      {children.length > 0 && (
        <p>{children.map((c) => <Link key={c.id} to={`/board/${c.id}`}>{tx(c.name, lang)} </Link>)}</p>
      )}
      {component.id === "gpio" && <Link to="/pins/1">Pin 1</Link>}
      {source && <p><a href={source.url}>{source.title}</a></p>}
    </article>
  );
}

function CompareCard() {
  const { catalog, lang } = useLab();
  const t = strings(lang);
  const compare = catalog.board.compare_zero_2w;
  return (
    <article className="record">
      <h2>{t.compare}</h2>
      <ul>{compare.different.map((row) => (
        <li key={row.topic.en}><b>{tx(row.topic, lang)}</b> — Zero W: {row.zero_w}. Zero 2 W: {row.zero_2w}</li>
      ))}</ul>
      <p>{compare.ram_note}</p>
    </article>
  );
}

function Disagreements() {
  const { catalog, lang } = useLab();
  return (
    <article className="record warn-card">
      <h2>{strings(lang).disagreements}</h2>
      {catalog.board.disagreements.map((row) => (
        <section key={row.id}>
          <h3>{row.id}</h3>
          <p>{row.note}</p>
          <ul>
            {row.claims.map((claim) => (
              <li key={claim.value}>{claim.value} — {catalog.sources[claim.source]?.title}</li>
            ))}
          </ul>
        </section>
      ))}
    </article>
  );
}

export function LessonsPage() {
  const { catalog, lang, progress } = useLab();
  const t = strings(lang);
  return (
    <div className="page">
      <h1>{t.tracks}</h1>
      <div className="tracks">
        {catalog.tracks.map((track) => {
          const lessons = catalog.lessons
            .filter((l) => l.track === track.id && fitsBoard(l, catalog.board.id))
            .sort((a, b) => (a.order || 0) - (b.order || 0));
          return (
            <section key={track.id} className="track">
              <h2>{tx(track.name, lang)}</h2>
              <p>{tx(track.blurb, lang)}</p>
              {lessons.length === 0 && <p className="note">{t.advancedEmpty}</p>}
              {lessons.map((lesson) => {
                const done = progress.passed?.[lesson.id];
                const missing = lesson.prereqs.filter((id) => !progress.passed?.[id]);
                return (
                  <article key={lesson.id} className="card">
                    <h3>{tx(lesson.title, lang)}</h3>
                    <p>{tx(lesson.summary, lang)}</p>
                    <p className="meta">{lesson.est_min} {t.minutes} {done && `· ${t.passed}`}</p>
                    {missing.length > 0 ? (
                      <p className="note">{t.locked}. {t.needs} {missing.join(", ")}</p>
                    ) : (
                      <Link to={`/lessons/${lesson.id}`}>{t.start}</Link>
                    )}
                  </article>
                );
              })}
            </section>
          );
        })}
      </div>
    </div>
  );
}

export function NotFound() {
  const { lang } = useLab();
  const t = strings(lang);
  return (
    <div className="page">
      <article className="card">
        <h1>{t.missing}</h1>
        <Link to="/">{t.backBoard}</Link>
      </article>
    </div>
  );
}

export function LessonPage() {
  const { id } = useParams();
  const lab = useLab();
  const t = strings(lab.lang);
  const lesson = lab.catalog.lessons.find((l) => l.id === id);
  const [answers, setAnswers] = useState({});
  const [marked, setMarked] = useState(null);
  const [section, setSection] = useState(0);

  useEffect(() => {
    setAnswers({});
    setMarked(null);
    setSection(0);
    if (lesson) lab.setSelection({ kind: "lesson", id: lesson.id });
  }, [id]);

  useEffect(() => {
    lab.setStep({ kind: "lesson", lessonId: id, section });
  }, [id, section]);

  if (!lesson) return <NotFound />;
  const wrongBoard = mismatch(lesson, lab.catalog.board.id);
  const missing = lesson.prereqs.filter((pid) => !lab.progress.passed?.[pid]);
  if (missing.length) {
    return <p className="page">{t.locked}. {t.needs} {missing.join(", ")}</p>;
  }

  function mark(event) {
    event.preventDefault();
    if (lesson.quiz.some((q) => answers[q.id] == null)) {
      setMarked({ ok: false, need: true, rows: [] });
      return;
    }
    const rows = lesson.quiz.map((q) => ({
      id: q.id,
      right: Number(answers[q.id]) === q.answer,
      explain: tx(q.explain, lab.lang),
    }));
    const score = rows.filter((r) => r.right).length;
    const ok = score === lesson.quiz.length;
    if (ok) lab.passLesson(lesson.id, score, lesson.quiz.length, lesson.badge.id);
    setMarked({ ok, need: false, rows, score });
  }

  return (
    <article className="page lesson">
      <p className="meta">{tx(lab.catalog.tracks.find((tr) => tr.id === lesson.track)?.name, lab.lang)} · {lesson.est_min} {t.minutes}</p>
      <h1>{tx(lesson.title, lab.lang)}</h1>
      {wrongBoard && <SwitchBoard ids={wrongBoard} />}
      {lesson.sections.map((sectionRow, index) => (
        <section key={index} onFocus={() => setSection(index)} className={section === index ? "section on" : "section"}>
          {lab.lang === "zh-CN" && sectionRow.kind === "md" && !sectionRow.text?.["zh-CN"] && (
            <p className="note">本课正文暂为英文</p>
          )}
          {sectionRow.kind === "md" ? <Markdown text={tx(sectionRow.text, lab.lang)} /> : <Widget id={sectionRow.id} />}
        </section>
      ))}
      <form className="quiz" onSubmit={mark}>
        {lesson.quiz.map((q, qi) => (
          <fieldset key={q.id}>
            <legend>{qi + 1}. {tx(q.prompt, lab.lang)}</legend>
            {q.choices.map((choice, ci) => (
              <label key={ci}>
                <input type="radio" name={q.id} checked={Number(answers[q.id]) === ci} onChange={() => setAnswers({ ...answers, [q.id]: ci })} />
                {tx(choice, lab.lang)}
              </label>
            ))}
            {marked && !marked.need && (
              <p className={marked.rows.find((r) => r.id === q.id)?.right ? "ok" : "warn"}>
                {marked.rows.find((r) => r.id === q.id)?.explain}
              </p>
            )}
          </fieldset>
        ))}
        <button type="submit">{t.quiz}</button>
        {marked?.need && <p className="warn">{t.quizNeed}</p>}
        {marked && !marked.need && <p className={marked.ok ? "ok" : "warn"}>{marked.ok ? t.quizPass : t.quizFail}</p>}
      </form>
      <SourceList ids={lesson.sources} />
    </article>
  );
}

export function RoadmapPage() {
  const { lang } = useLab();
  const zh = lang === "zh-CN";
  const waves = [
    [zh ? "第二波" : "Wave 2", zh ? "闪存系统、无头 Wi-Fi / SSH、排针（焊接、压接、不焊）。" : "Flash the OS, headless Wi-Fi and SSH, and headers: solder, hammer, or leave the pads bare."],
    [zh ? "第三波" : "Wave 3", zh ? "按钮、I2C 传感器、摄像头丝带、PWM 舵机。" : "Buttons, an I2C sensor, the camera ribbon, and a PWM servo."],
    [zh ? "第四波" : "Wave 4", zh ? "UART 和蓝牙。引脚冲突与功耗预算。" : "UART and Bluetooth, then pin conflicts and the power budget."],
    [zh ? "第五波" : "Wave 5", zh ? "把课程接到真实作品上：Pi-hole、掌机、相机、墨水屏。" : "Tie the lessons to real builds: Pi-hole, a handheld, a camera, an e-paper board."],
  ];
  return (
    <article className="page">
      <h1>{zh ? "路线图" : "Roadmap"}</h1>
      <p>{zh ? "这一版只交付 Zero W 和三节入门课。下面是后面才会来的内容，现在还没有可运行的数据。" : "This release is the Zero W and three beginner lessons. The items below are planned. They are not live data yet."}</p>
      <h2>{zh ? "课程" : "Lessons"}</h2>
      <ul>{waves.map(([title, text]) => <li key={title}><b>{title}.</b> {text}</li>)}</ul>
      <h2>{zh ? "作品" : "Builds"}</h2>
      <p>{zh ? "Pi-hole、掌机、相机、墨水屏、气象站、USB 小工具、音乐播放、GPS/4G、智能镜。来源核对完才会进作品页。" : "Pi-hole, a handheld, a camera, e-paper, a weather station, a USB gadget, a music player, GPS/4G, and a smart mirror. They join Builds only after a source is checked."}</p>
      <h2>{zh ? "扩展板" : "HATs"}</h2>
      <p>{zh ? "零件盘里带 provisional 的条目来自调研，还不是最终 hats.json。更多厂家的板会在合并后出现。" : "Tray rows marked provisional come from research and are not the final hats.json. More makers land after that merge."}</p>
      <h2>{zh ? "工具" : "Tools"}</h2>
      <p>{zh ? "单独的引脚冲突检查页。装上第二块板时，板面上的冲突提示保持不变。" : "A standalone pin-conflict checker page. The conflict flag shown when a second part is mounted stays on the board."}</p>
      <h2>{zh ? "其他 Zero" : "Other Zero boards"}</h2>
      <p>{zh ? "Zero v1.2、v1.3、WH、Zero 2 W、Zero 2 WH 在选择器里是 coming soon。不会借用 Zero W 的尺寸。" : "Zero v1.2, v1.3, WH, Zero 2 W, and Zero 2 WH stay on coming soon. Their geometry is not copied from the Zero W."}</p>
    </article>
  );
}

export function BuildsPage() {
  const { catalog, lang } = useLab();
  return (
    <div className="page">
      <p><Link to="/roadmap">{lang === "zh-CN" ? "更多作品在路线图上。" : "Further builds are listed on the Roadmap."}</Link></p>
      <div className="cards">
        {catalog.builds.filter((build) => fitsBoard(build, catalog.board.id)).map((build) => (
          <article key={build.id} className="card">
            <h2><Link to={`/builds/${build.id}`}>{tx(build.title, lang)}</Link></h2>
            <p>{tx(build.summary, lang)}</p>
            <p className="meta">{tx(build.difficulty, lang)} · {build.zero_w}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

export function BuildPage() {
  const { id } = useParams();
  const lab = useLab();
  const navigate = useNavigate();
  const t = strings(lab.lang);
  const build = lab.catalog.builds.find((b) => b.id === id);
  const [index, setIndex] = useState(0);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setIndex(0);
    setNotice("");
    if (build) lab.setSelection({ kind: "build", id: build.id });
  }, [id]);

  useEffect(() => {
    lab.setStep({ kind: "build", buildId: id, stepIndex: index });
  }, [id, index]);

  if (!build) return null;
  const played = replaySteps(build, index, lab.catalog);
  const frame = played.frames[index];
  const source = lab.catalog.sources[build.source];

  function load() {
    lab.dispatch({ type: "loadBuild", buildId: build.id });
    setNotice(t.loaded);
    navigate("/");
  }

  return (
    <article className="page">
      <h1>{tx(build.title, lab.lang)}</h1>
      {mismatch(build, lab.catalog.board.id) && <SwitchBoard ids={mismatch(build, lab.catalog.board.id)} />}
      <p>{tx(build.summary, lab.lang)}</p>
      <p className="note">{tx(build.zero_w_note, lab.lang)}</p>
      {source && <p><a href={source.url}>{source.title}</a></p>}
      <BomList catalog={lab.catalog} state={replaySteps(build, build.steps.length - 1, lab.catalog).state} lang={lab.lang} t={t} approx />
      <Workbench state={played.state} onDispatch={() => {}} compact />
      <div className="stepper">
        <button type="button" onClick={() => setIndex((n) => Math.max(0, n - 1))} disabled={index === 0}>{t.back}</button>
        <span>{t.step} {index + 1} / {build.steps.length}</span>
        <button type="button" onClick={() => setIndex((n) => Math.min(build.steps.length - 1, n + 1))} disabled={index === build.steps.length - 1}>{t.next}</button>
      </div>
      {frame && (
        <section className="record">
          <h2>{tx(frame.step.title, lab.lang)}</h2>
          <p>{tx(frame.step.text, lab.lang)}</p>
          {(frame.step.links || []).map((link) => {
            const src = lab.catalog.sources[link.source];
            return src ? <p key={link.source}><a href={src.url}>{tx(link.label, lab.lang)}</a></p> : null;
          })}
          {frame.error && <p className="warn">{t.refused}: {frame.error.code}</p>}
        </section>
      )}
      <button type="button" className="load" onClick={load}>{t.load}</button>
      {notice && <p className="ok">{notice}</p>}
    </article>
  );
}

export function PartPage() {
  const { id } = useParams();
  const { catalog, lang, setSelection } = useLab();
  const part = catalog.parts.find((p) => p.id === id);
  useEffect(() => { if (part) setSelection({ kind: "part", id: part.id }); }, [id]);
  if (!part) return null;
  const source = catalog.sources[part.source];
  return (
    <article className="page record">
      <h1>{tx(part.name, lang)}</h1>
      <p>{tx(part.summary, lang)}</p>
      {mismatch(part, catalog.board.id) && <SwitchBoard ids={mismatch(part, catalog.board.id)} />}
      <p className="meta">{part.maker || "—"} · {part.zero_w}</p>
      <p>{tx(part.zero_w_note, lang)}</p>
      <p>{tx(part.dims_note, lang)}</p>
      <p>{part.price_usd == null ? strings(lang).unpriced : `$${part.price_usd}`}</p>
      {part.product_url && <p><a href={part.product_url}>{part.product_url}</a></p>}
      {source && <p><a href={source.url}>{source.title}</a></p>}
    </article>
  );
}

export function PinPage() {
  const { physical } = useParams();
  const lab = useLab();
  useEffect(() => { lab.setSelection({ kind: "pin", physical: Number(physical) }); }, [physical]);
  return <div className="page"><PinFacts physical={physical} /></div>;
}

export function InstrumentsPage() {
  const { catalog, lang } = useLab();
  const t = strings(lang);
  const [power, setPower] = useState(null);
  const [hdmi, setHdmi] = useState(false);
  const [camera, setCamera] = useState(false);
  const [usb, setUsb] = useState("0");
  const [owned, setOwned] = useState([]);
  const [recs, setRecs] = useState(null);
  const [clash, setClash] = useState(null);

  async function runPower(event) {
    event.preventDefault();
    setPower(labCall("power", { hdmi, camera, usb_ma: Number(usb), board: catalog.board.id }, catalog));
  }

  function toggle(id) {
    setOwned((list) => list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  async function runOwned(event) {
    event.preventDefault();
    setRecs(labCall("recommend", { owned, board: catalog.board.id }, catalog));
    setClash(labCall("conflicts", { part_ids: owned, board: catalog.board.id }, catalog));
  }

  return (
    <div className="page instruments">
      <OhmWidget />
      <form onSubmit={runPower} className="widget">
        <h2>{t.power}</h2>
        <label><input type="checkbox" checked={hdmi} onChange={(e) => setHdmi(e.target.checked)} /> HDMI</label>
        <label><input type="checkbox" checked={camera} onChange={(e) => setCamera(e.target.checked)} /> Camera</label>
        <label>USB mA <input value={usb} onChange={(e) => setUsb(e.target.value)} /></label>
        <button type="submit">{t.run}</button>
        {power && !power.error && (
          <div>
            <p>{power.total_ma} mA / {power.psu_ma} mA · {power.supply_v} V</p>
            <p>{power.over ? "over the recommended supply" : `${power.headroom_ma} mA headroom`}</p>
            <ul>{power.rows.map((row) => <li key={row.id}>{row.id}: {row.ma} mA — {row.note}</li>)}</ul>
            {!power.undervoltage_detect && <p className="note">Zero range: no undervoltage detector.</p>}
          </div>
        )}
      </form>
      <form onSubmit={runOwned} className="widget">
        <h2>{t.recommend}</h2>
        {catalog.parts.filter((part) => fitsBoard(part, catalog.board.id)).map((part) => (
          <label key={part.id}>
            <input type="checkbox" checked={owned.includes(part.id)} onChange={() => toggle(part.id)} />
            {tx(part.name, lang)}
          </label>
        ))}
        <button type="submit">{t.run}</button>
        {recs && (
          <ul>
            {recs.builds.map((build) => (
              <li key={build.id}>{tx(build.title, lang)} · {Math.round(build.score * 100)}% · {build.zero_w}</li>
            ))}
          </ul>
        )}
        {clash && (
          <div>
            <h3>{t.conflict}</h3>
            <p>{clash.note}</p>
            <ul>{(clash.unchecked || []).map((row) => <li key={row.part_id}>{row.part_id}: {row.reason}</li>)}</ul>
          </div>
        )}
      </form>
    </div>
  );
}

export function SettingsPage() {
  const { lang } = useLab();
  const t = strings(lang);
  const existing = readCredentials();
  const [provider, setProvider] = useState(existing.provider);
  const [model, setModel] = useState(existing.model);
  const [apiKey, setApiKey] = useState(existing.apiKey);
  const [remember, setRemember] = useState(existing.remember);
  const [note, setNote] = useState("");

  function save(event) {
    event.preventDefault();
    writeCredentials({ remember, provider, model, apiKey });
    notifyKeyChange();
    setNote(t.saved);
  }

  function forget() {
    forgetCredentials();
    setApiKey("");
    notifyKeyChange();
    setNote(t.forgotten);
  }

  return (
    <form className="page widget settings" onSubmit={save}>
      <h1>{t.settings}</h1>
      <p>{t.noProxy}</p>
      <label>{t.provider}
        <select value={provider} onChange={(e) => { setProvider(e.target.value); setModel(defaultModel(e.target.value)); }}>
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
        </select>
      </label>
      <label>{t.model}
        <input value={model} onChange={(e) => setModel(e.target.value)} list="models" />
        <datalist id="models">
          <option value="gpt-4o-mini" />
          <option value="gpt-4o" />
          <option value="claude-sonnet-4-5" />
          <option value="claude-3-5-haiku-latest" />
        </datalist>
      </label>
      <label>{t.key}
        <input type="password" value={apiKey} autoComplete="off" onChange={(e) => setApiKey(e.target.value)} />
      </label>
      <label><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> {t.remember}</label>
      <div className="row">
        <button type="submit">{t.save}</button>
        <button type="button" onClick={forget}>{t.forget}</button>
      </div>
      {note && <p className="ok">{note}</p>}
    </form>
  );
}

export function SwitchBoard({ ids }) {
  const { catalog, lang, pickBoard } = useLab();
  const t = strings(lang);
  const live = ids.filter((id) => catalog.boards.models[id]);
  return (
    <p className="switch-board">
      {t.switchBoard}
      {live.map((id) => (
        <button key={id} type="button" onClick={() => pickBoard(id)}>
          {tx(catalog.boards.base.models.find((model) => model.id === id)?.name, lang)}
        </button>
      ))}
      {live.length === 0 && <span> {ids.join(", ")}</span>}
    </p>
  );
}

function SourceList({ ids }) {
  const { catalog, lang } = useLab();
  return (
    <section>
      <h2>{strings(lang).sources}</h2>
      <ul>
        {ids.map((id) => {
          const source = catalog.sources[id];
          return <li key={id}>{source ? <a href={source.url}>{source.title}</a> : id}</li>;
        })}
      </ul>
    </section>
  );
}
