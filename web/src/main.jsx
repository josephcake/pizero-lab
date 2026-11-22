import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { strings } from "./i18n.js";
import { searchCatalog } from "./staticCatalog.js";
import { HelpDock } from "./help.jsx";
import { BoardPage, BuildPage, BuildsPage, InstrumentsPage, LessonPage, LessonsPage, NotFound, PartPage, PartsPage, PinPage, RoadmapPage, SettingsPage } from "./pages.jsx";
import { LabProvider, useLab } from "./state.jsx";
import "./styles.css";

function SearchBox() {
  const { lang, catalog } = useLab();
  const boardId = catalog?.board?.id || "";
  const t = strings(lang);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!q.trim()) {
      setHits([]);
      return;
    }
    const handle = setTimeout(() => {
      setHits(catalog ? searchCatalog(catalog, q, boardId) : []);
    }, 150);
    return () => clearTimeout(handle);
  }, [q, boardId]);

  return (
    <>
    <button type="button" className="search-toggle" aria-label={t.search} onClick={() => setOpen((value) => !value)}>⌕</button>
    <div className={open ? "search open" : "search"}>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.search} aria-label={t.search} />
      {q && (
        <ul>
          {hits.length === 0 && <li>{t.nohits}</li>}
          {hits.map((hit) => (
            <li key={`${hit.kind}-${hit.id}`}>
              <Link to={hit.href} onClick={() => setQ("")}>{hit.kind} · {typeof hit.title === "string" ? hit.title : hit.title[lang] || hit.title.en}</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
    </>
  );
}

function BoardPicker() {
  const { catalog, lang, pickBoard } = useLab();
  const t = strings(lang);
  if (!catalog) return null;
  return (
    <label className="board-picker">
      {t.picker}
      <select aria-label={t.picker} value={catalog.modelId} onChange={(event) => pickBoard(event.target.value)}>
        {catalog.boards.base.models.map((model) => {
          const live = Boolean(catalog.boards.models[model.id]);
          return (
            <option key={model.id} value={model.id} disabled={!live}>
              {txName(model)}{live ? "" : ` · ${t.coming}`}
            </option>
          );
        })}
      </select>
    </label>
  );
}

const SHORT_BOARD = {
  "zero-v1.2": "Zero v1.2",
  "zero-v1.3": "Zero v1.3",
  "zero-w": "Zero W",
  "zero-wh": "Zero WH",
  "zero-2-w": "Zero 2 W",
  "zero-2-wh": "Zero 2 WH",
};

function txName(model) {
  return SHORT_BOARD[model.id] || model.name?.en || model.id;
}

function Shell() {
  const { lang, setLang, error, catalog } = useLab();
  const t = strings(lang);
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => {
    document.documentElement.lang = lang === "zh-CN" ? "zh" : "en";
  }, [lang]);
  if (error) return <p className="page">{t.catalogDown}</p>;
  if (!catalog) return <p className="page">{t.loading}</p>;
  const links = [
    ["/", t.navBoard, ""],
    ["/lessons", t.navLearn, ""],
    ["/builds", t.navBuilds, ""],
    ["/parts", t.navParts, "wide"],
    ["/instruments", t.navTools, "wide"],
  ];
  return (
    <div className="sheet">
      <button type="button" className="skip" onClick={() => document.getElementById("board")?.focus()}>{t.skip}</button>
      <header className="mast">
        <div className="brand">
          <Link to="/" className="wordmark">pizero<i>/</i>lab</Link>
          <BoardPicker />
        </div>
        <nav className="index-nav">
          {links.map(([href, label, extra]) => (
            <NavLink key={href} to={href} end={href === "/"} className={({ isActive }) => `${extra} ${isActive || (href === "/" && location.pathname.startsWith("/board")) ? "on" : ""}`}>
              {label}
            </NavLink>
          ))}
          <NavLink to="/instruments" className="more-link">{t.more}</NavLink>
        </nav>
        <SearchBox />
        <div className="lang" role="group" aria-label={t.lang}>
          <button type="button" className="lang-one" onClick={() => setLang(lang === "en" ? "zh-CN" : "en")}>{lang === "en" ? "中文" : "EN"}</button>
          <button type="button" className={lang === "en" ? "on lang-pair" : "lang-pair"} onClick={() => setLang("en")}>EN</button>
          <button type="button" className={lang === "zh-CN" ? "on lang-pair" : "lang-pair"} onClick={() => setLang("zh-CN")}>中文</button>
          <ThemeButton />
        </div>
      </header>
      <div className="spread">
        <main>
          <Routes>
            <Route path="/" element={<BoardPage />} />
            <Route path="/board/:id" element={<BoardPage />} />
            <Route path="/lessons" element={<LessonsPage />} />
            <Route path="/lessons/:id" element={<LessonPage />} />
            <Route path="/builds" element={<BuildsPage />} />
            <Route path="/roadmap" element={<RoadmapPage />} />
            <Route path="/builds/:id" element={<BuildPage />} />
            <Route path="/instruments" element={<InstrumentsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/parts" element={<PartsPage />} />
            <Route path="/parts/:id" element={<PartPage />} />
            <Route path="/pins/:physical" element={<PinPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
        <HelpDock />
      </div>
      <nav className="tabbar">
        <NavLink to="/" end><span aria-hidden="true">▦</span>{t.navBoard}</NavLink>
        <NavLink to="/lessons"><span aria-hidden="true">◎</span>{t.navLearn}</NavLink>
        <NavLink to="/builds"><span aria-hidden="true">▣</span>{t.navBuilds}</NavLink>
        <NavLink to="/settings"><span aria-hidden="true">?</span>{t.tabHelp}</NavLink>
        <button type="button" className={moreOpen ? "on" : ""} onClick={() => setMoreOpen((value) => !value)}><span aria-hidden="true">…</span>{t.more}</button>
      </nav>
      {moreOpen && (
        <>
          <button type="button" className="sheet-backdrop" aria-label={t.close} onClick={() => setMoreOpen(false)} />
          <nav className="more-sheet" aria-label={t.more}>
            <Link to="/parts" onClick={() => setMoreOpen(false)}>{t.navParts}</Link>
            <Link to="/instruments" onClick={() => setMoreOpen(false)}>{t.navTools}</Link>
            <Link to="/roadmap" onClick={() => setMoreOpen(false)}>{t.roadmap}</Link>
            <Link to="/settings" onClick={() => setMoreOpen(false)}>{t.settings}</Link>
          </nav>
        </>
      )}
    </div>
  );
}

function ThemeButton() {
  const [theme, setTheme] = useState(() => localStorage.getItem("pz.theme") || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("pz.theme", theme);
  }, [theme]);
  const night = theme === "dark";
  return <button type="button" className="theme-btn" aria-label={night ? "Day" : "Night"} onClick={() => setTheme(night ? "light" : "dark")}>{night ? "☀" : "☾"}</button>;
}

function App() {
  return (
    <HashRouter>
      <LabProvider>
        <Shell />
      </LabProvider>
    </HashRouter>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
