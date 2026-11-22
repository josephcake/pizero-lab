import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { strings } from "./i18n.js";
import { HelpDock } from "./help.jsx";
import { BoardPage, BuildPage, BuildsPage, InstrumentsPage, LessonPage, LessonsPage, PartPage, PinPage, SettingsPage } from "./pages.jsx";
import { LabProvider, useLab } from "./state.jsx";
import "./styles.css";

function SearchBox() {
  const { lang, catalog } = useLab();
  const boardId = catalog?.board?.id || "";
  const t = strings(lang);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState([]);

  useEffect(() => {
    if (!q.trim()) {
      setHits([]);
      return;
    }
    const handle = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}&board=${encodeURIComponent(boardId)}`)
        .then((r) => r.json())
        .then((data) => setHits(data.hits || []))
        .catch(() => setHits([]));
    }, 150);
    return () => clearTimeout(handle);
  }, [q, boardId]);

  return (
    <div className="search">
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
        {catalog.liveModels.map((model) => (
          <option key={model.id} value={model.id}>{txName(model, lang)}</option>
        ))}
      </select>
    </label>
  );
}

function txName(model, lang) {
  return model.name?.[lang] || model.name?.en || model.id;
}

function Shell() {
  const { lang, setLang, error, catalog } = useLab();
  const t = strings(lang);
  const location = useLocation();
  if (error) return <p className="page">{t.catalogDown}</p>;
  if (!catalog) return <p className="page">{t.loading}</p>;
  const links = [
    ["/", t.board],
    ["/lessons", t.lessons],
    ["/builds", t.builds],
    ["/instruments", t.instruments],
    ["/settings", t.settings],
  ];
  return (
    <div className="sheet">
      <header className="mast">
        <div>
          <p className="eyebrow">65 × 30</p>
          <Link to="/" className="wordmark">pizero<i>/</i>lab</Link>
          <p className="tag">{t.tag}</p>
        </div>
        <nav className="index-nav">
          {links.map(([href, label]) => (
            <NavLink key={href} to={href} end={href === "/"} className={({ isActive }) => isActive || (href === "/" && location.pathname.startsWith("/board")) ? "on" : ""}>
              {label}
            </NavLink>
          ))}
        </nav>
        <SearchBox />
        <div className="lang" role="group" aria-label={t.lang}>
          <BoardPicker />
          <button type="button" className={lang === "en" ? "on" : ""} onClick={() => setLang("en")}>EN</button>
          <button type="button" className={lang === "zh-CN" ? "on" : ""} onClick={() => setLang("zh-CN")}>中文</button>
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
            <Route path="/builds/:id" element={<BuildPage />} />
            <Route path="/instruments" element={<InstrumentsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/parts/:id" element={<PartPage />} />
            <Route path="/pins/:physical" element={<PinPage />} />
          </Routes>
        </main>
        <HelpDock />
      </div>
      <nav className="tabbar">
        <NavLink to="/" end>Board</NavLink>
        <NavLink to="/lessons">Learn</NavLink>
        <NavLink to="/builds">Builds</NavLink>
        <NavLink to="/settings">Help</NavLink>
        <NavLink to="/instruments">More</NavLink>
      </nav>
    </div>
  );
}

function ThemeButton() {
  const [theme, setTheme] = useState(() => localStorage.getItem("pz.theme") || "dark");
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("pz.theme", theme);
  }, [theme]);
  return <button type="button" aria-label="Theme" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? "Day" : "Night"}</button>;
}

function App() {
  return (
    <BrowserRouter>
      <LabProvider>
        <Shell />
      </LabProvider>
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
