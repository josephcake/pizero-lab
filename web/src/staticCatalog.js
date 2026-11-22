import { adaptFluxBoard, adaptPinout, hatToPart } from "../../shared/flux.mjs";
import { applyUnderside } from "../../shared/underside.mjs";
import fluxBoard from "../../data/boards/zero-w.flux.json";
import underside from "../../data/boards/zero-w.underside.json";
import fluxPins from "../../data/pinout.flux.json";
import partsDoc from "../../data/parts.json";
import hatsDoc from "../../data/hats.json";
import sources from "../../data/sources.json";
import electrical from "../../data/electrical.json";
import bomRules from "../../data/bom-rules.json";
import tracks from "../../data/tracks.json";
import base from "../../data/boards/_base.json";

const lessonMods = import.meta.glob("../../data/lessons/*.json", { eager: true, import: "default" });
const buildMods = import.meta.glob("../../data/builds/*.json", { eager: true, import: "default" });

export function getCatalog() {
  const pinout = adaptPinout(fluxPins);
  const board = adaptFluxBoard(fluxBoard, fluxPins);
  applyUnderside(board, underside);
  board.pinout = pinout;
  const ids = new Set(partsDoc.parts.map((part) => part.id));
  const parts = partsDoc.parts.concat(hatsDoc.parts.map(hatToPart).filter((part) => !ids.has(part.id)));
  return {
    sources: sources.sources,
    electrical,
    bomRules: bomRules.rules,
    tracks: tracks.tracks,
    boards: { base, models: { "zero-w": board } },
    board,
    pinout,
    parts,
    lessons: Object.values(lessonMods),
    builds: Object.values(buildMods),
  };
}

function localized(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return [value.en, value["zh-CN"]].filter(Boolean).join(" ");
}

export function searchCatalog(catalog, q, boardId) {
  const query = q.trim().toLowerCase();
  if (!query) return [];
  const hits = [];
  const matches = (...values) => values.some((value) => localized(value).toLowerCase().includes(query));
  const onBoard = (item) => Array.isArray(item.boards) && item.boards.includes(boardId);
  for (const lesson of catalog.lessons) {
    if (!onBoard(lesson)) continue;
    if (matches(lesson.title, lesson.summary)) {
      hits.push({ kind: "lesson", id: lesson.id, title: lesson.title, href: `/lessons/${lesson.id}` });
    }
  }
  for (const build of catalog.builds) {
    if (!onBoard(build)) continue;
    if (matches(build.title, build.summary)) {
      hits.push({ kind: "build", id: build.id, title: build.title, href: `/builds/${build.id}` });
    }
  }
  for (const part of catalog.parts) {
    if (!onBoard(part)) continue;
    if (matches(part.name, part.summary)) {
      hits.push({ kind: "part", id: part.id, title: part.name, href: `/parts/${part.id}` });
    }
  }
  return hits.slice(0, 20);
}
