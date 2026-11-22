import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { deriveBom, emptyState, reducer } from "../../shared/bench.mjs";
import { initialHeader, sourcedModels } from "../../shared/boards.mjs";

const Ctx = createContext(null);
export function useLab() {
  return useContext(Ctx);
}

const PROGRESS = "pizero-progress";
const LANG = "pizero-lang";
const BOARD = "pizero-board";

export function tx(value, lang) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  return value[lang] || value.en || "";
}

export function LabProvider({ children }) {
  const [catalog, setCatalog] = useState(null);
  const [error, setError] = useState("");
  const [lang, setLang] = useState(() => localStorage.getItem(LANG) || "en");
  const [modelId, setModelId] = useState(() => localStorage.getItem(BOARD) || "");
  const [fading, setFading] = useState(false);
  const [bench, setBench] = useState(emptyState());
  const [selection, setSelection] = useState(null);
  const [progress, setProgress] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(PROGRESS)) || { passed: {}, badges: [] };
    } catch {
      return { passed: {}, badges: [] };
    }
  });
  const [step, setStep] = useState(null);

  useEffect(() => {
    fetch("/api/catalog")
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then(setCatalog)
      .catch(() => setError("catalog"));
  }, []);

  useEffect(() => {
    localStorage.setItem(LANG, lang);
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    localStorage.setItem(PROGRESS, JSON.stringify(progress));
  }, [progress]);

  const active = useMemo(() => {
    if (!catalog) return null;
    const live = sourcedModels(catalog.boards.base);
    const id = catalog.boards.models[modelId] ? modelId : catalog.boards.base.defaultModel;
    const board = catalog.boards.models[id];
    return {
      ...catalog,
      board,
      pinout: board.pinout || catalog.pinout,
      modelId: id,
      liveModels: live,
    };
  }, [catalog, modelId]);

  useEffect(() => {
    if (active?.modelId) localStorage.setItem(BOARD, active.modelId);
  }, [active?.modelId]);

  const bom = useMemo(() => (active ? deriveBom(bench, active) : null), [active, bench]);

  function dispatch(action) {
    if (!active) return null;
    const result = reducer(bench, action, active);
    setBench(result.state);
    return result;
  }

  function pickBoard(id) {
    if (!catalog?.boards.models[id] || id === active?.modelId) return;
    setFading(true);
    window.setTimeout(() => {
      const entry = catalog.boards.base.models.find((model) => model.id === id);
      setModelId(id);
      setBench({ ...emptyState(), header: initialHeader(entry) });
      setFading(false);
    }, 200);
  }

  function passLesson(id, score, total, badgeId) {
    setProgress((prev) => ({
      passed: { ...prev.passed, [id]: { score, total, at: new Date().toISOString() } },
      badges: Array.from(new Set([...(prev.badges || []), badgeId])),
    }));
  }

  return (
    <Ctx.Provider
      value={{
        catalog: active,
        error,
        lang,
        setLang,
        fading,
        pickBoard,
        bench,
        setBench,
        dispatch,
        bom,
        selection,
        setSelection,
        progress,
        passLesson,
        step,
        setStep,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
