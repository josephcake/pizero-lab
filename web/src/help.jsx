import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { buildHelpContext } from "../../shared/context.mjs";
import { askProvider } from "../../shared/provider.mjs";
import { strings } from "./i18n.js";
import { useLab } from "./state.jsx";

const KEY = "field65-api-key";

export function readCredentials() {
  const remember = localStorage.getItem("field65-remember") === "1";
  const store = remember ? localStorage : sessionStorage;
  return {
    remember,
    provider: store.getItem("field65-provider") || "openai",
    model: store.getItem("field65-model") || defaultModel(store.getItem("field65-provider") || "openai"),
    apiKey: store.getItem(KEY) || "",
  };
}

export function writeCredentials({ remember, provider, model, apiKey }) {
  forgetCredentials();
  const store = remember ? localStorage : sessionStorage;
  if (remember) localStorage.setItem("field65-remember", "1");
  store.setItem("field65-provider", provider);
  store.setItem("field65-model", model);
  if (apiKey) store.setItem(KEY, apiKey);
}

export function forgetCredentials() {
  for (const store of [localStorage, sessionStorage]) {
    store.removeItem(KEY);
    store.removeItem("field65-provider");
    store.removeItem("field65-model");
  }
  localStorage.removeItem("field65-remember");
}

export function defaultModel(provider) {
  return provider === "anthropic" ? "claude-sonnet-4-5" : "gpt-4o-mini";
}

export { askProvider };

export function HelpDock() {
  const lab = useLab();
  const t = strings(lab.lang);
  const [creds, setCreds] = useState(readCredentials);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onStore = () => setCreds(readCredentials());
    window.addEventListener("field65-key", onStore);
    return () => window.removeEventListener("field65-key", onStore);
  }, []);

  async function send(event) {
    event.preventDefault();
    if (!lab.catalog || !creds.apiKey) return;
    setBusy(true);
    setError("");
    const context = buildHelpContext({
      catalog: lab.catalog,
      route: window.location.pathname,
      lang: lab.lang,
      selection: lab.selection,
      bench: lab.bench,
      bom: lab.bom,
      conflicts: null,
      step: lab.step,
    });
    try {
      setAnswer(await askProvider({ ...creds, context, question }));
    } catch (err) {
      setError(err.message || t.helpFail);
    } finally {
      setBusy(false);
    }
  }

  if (!creds.apiKey) {
    return <Link className="ask-tab" to="/settings">{t.helpSend}</Link>;
  }

  return (
    <aside className="help">
      <h2>{t.help}</h2>
      {!creds.apiKey && (
        <p>{t.helpEmpty} <Link to="/settings">{t.settings}</Link></p>
      )}
      {creds.apiKey && (
        <form onSubmit={send}>
          <textarea value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={t.helpAsk} rows={4} />
          <button type="submit" disabled={busy || !question.trim()}>{busy ? t.helpWorking : t.helpSend}</button>
        </form>
      )}
      {error && <p className="warn">{error}</p>}
      {answer && <div className="answer">{answer}</div>}
    </aside>
  );
}

export function notifyKeyChange() {
  window.dispatchEvent(new Event("field65-key"));
}
