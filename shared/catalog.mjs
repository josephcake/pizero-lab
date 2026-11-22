import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { toSvgFrame } from "./boards.mjs";

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

export async function loadCatalog(root) {
  const data = path.join(root, "data");
  const boardsDir = path.join(data, "boards");
  const [sources, electrical, bomRules, tracks, alias, pinout, partsDoc, base] = await Promise.all([
    readJson(path.join(data, "sources.json")),
    readJson(path.join(data, "electrical.json")),
    readJson(path.join(data, "bom-rules.json")),
    readJson(path.join(data, "tracks.json")),
    readJson(path.join(data, "board.json")),
    readJson(path.join(data, "pinout.json")),
    readJson(path.join(data, "parts.json")),
    readJson(path.join(boardsDir, "_base.json")),
  ]);
  const models = {};
  for (const entry of base.models || []) {
    if (!entry.sourced || !entry.file) continue;
    const raw = await readJson(path.join(boardsDir, entry.file));
    if (raw.id !== entry.id) {
      throw new Error(`Board file ${entry.file} is ${raw.id}, expected ${entry.id}`);
    }
    const rendered = toSvgFrame(raw);
    if (raw.pinoutRef === "pinout.json") rendered.pinout = pinout;
    models[entry.id] = rendered;
  }
  const aliasId = alias.aliasOf || base.defaultModel;
  if (!models[aliasId]) throw new Error(`board.json alias ${aliasId} has no sourced file`);
  const lessons = await readDirJson(path.join(data, "lessons"));
  const builds = await readDirJson(path.join(data, "builds"));
  return {
    sources: sources.sources,
    electrical,
    bomRules: bomRules.rules,
    tracks: tracks.tracks,
    boards: { base, models },
    board: models[aliasId],
    pinout: models[aliasId].pinout || pinout,
    parts: partsDoc.parts,
    lessons,
    builds,
  };
}

async function readDirJson(dir) {
  const names = (await readdir(dir)).filter((n) => n.endsWith(".json")).sort();
  const rows = await Promise.all(names.map((n) => readJson(path.join(dir, n))));
  return rows;
}
