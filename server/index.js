import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadCatalog } from "../shared/catalog.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalog = await loadCatalog(root);
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/catalog", (_req, res) => {
  res.json(catalog);
});

function onBoard(item, boardId) {
  return Array.isArray(item.boards) && item.boards.includes(boardId);
}

app.get("/api/search", (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  const boardId = String(req.query.board || catalog.boards.base.defaultModel);
  const model = catalog.boards.models[boardId] || catalog.board;
  if (!q) return res.json({ hits: [], board: model.id });
  const hits = [];
  const blob = (value) => JSON.stringify(value).toLowerCase();
  for (const lesson of catalog.lessons) {
    if (!onBoard(lesson, model.id)) continue;
    if (blob(lesson.title).includes(q) || blob(lesson.summary).includes(q)) {
      hits.push({ kind: "lesson", id: lesson.id, title: lesson.title, href: `/lessons/${lesson.id}` });
    }
  }
  for (const build of catalog.builds) {
    if (!onBoard(build, model.id)) continue;
    if (blob(build.title).includes(q) || blob(build.summary).includes(q)) {
      hits.push({ kind: "build", id: build.id, title: build.title, href: `/builds/${build.id}` });
    }
  }
  for (const part of catalog.parts) {
    if (!onBoard(part, model.id)) continue;
    if (blob(part.name).includes(q) || blob(part.summary).includes(q)) {
      hits.push({ kind: "part", id: part.id, title: part.name, href: `/parts/${part.id}` });
    }
  }
  for (const pin of (model.pinout?.pins || [])) {
    const label = `pin ${pin.physical} ${pin.name}`;
    if (label.includes(q) || (pin.bcm != null && `gpio${pin.bcm}` === q.replace(/\s/g, ""))) {
      hits.push({
        kind: "pin",
        id: String(pin.physical),
        title: { en: `Pin ${pin.physical} · ${pin.name}`, es: `Pin ${pin.physical} · ${pin.name}` },
        href: `/pins/${pin.physical}`,
      });
    }
  }
  for (const component of model.components || []) {
    if (blob(component.name).includes(q) || blob(component.summary).includes(q)) {
      hits.push({ kind: "component", id: component.id, title: component.name, href: `/board/${component.id}` });
    }
  }
  res.json({ hits: hits.slice(0, 20) });
});

app.post("/api/lab/:tool", async (req, res) => {
  const tool = req.params.tool;
  if (!["resistor", "button", "gpio", "power", "conflicts", "recommend"].includes(tool)) {
    return res.status(404).json({ error: "unknown tool" });
  }
  try {
    const response = await fetch(`http://127.0.0.1:4741/${tool}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body ?? {}),
    });
    const text = await response.text();
    res.status(response.status).type("application/json").send(text);
  } catch (error) {
    res.status(502).json({ error: "lab tools are not running" });
  }
});

const port = Number(process.env.PORT || 4742);
app.listen(port, "127.0.0.1", () => {
  console.log(`catalog on http://127.0.0.1:${port}`);
});
