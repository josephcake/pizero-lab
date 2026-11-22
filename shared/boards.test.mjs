import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { loadCatalog } from "./catalog.mjs";
import { fitsBoard, initialHeader, mismatch, sourcedModels, toSvgFrame } from "./boards.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

test("only a sourced model is live, and other Zero models are not clones", async () => {
  const catalog = await loadCatalog(root);
  const live = sourcedModels(catalog.boards.base);
  assert.deepEqual(live.map((model) => model.id), ["zero-w"]);
  assert.equal(catalog.board.id, "zero-w");
  assert.equal(catalog.boards.models["zero-2-w"], undefined);
  assert.equal(catalog.boards.models["zero-wh"], undefined);
  const baseText = await readFile(path.join(root, "data/boards/_base.json"), "utf8");
  assert.equal(baseText.includes("65"), false);
  assert.equal(baseText.includes("BCM2835"), false);
  const alias = JSON.parse(await readFile(path.join(root, "data/board.json"), "utf8"));
  assert.equal(alias.aliasOf, "zero-w");
});

test("y-up coordinates convert once and null positions stay null", () => {
  const rendered = toSvgFrame({
    frame: { y: "up" },
    outline: { h_mm: { value: 30 } },
    anchors: [
      { id: "known", y_mm: 10 },
      { id: "missing", y_mm: null },
    ],
    components: [{ id: "chip", placement: { y_mm: 4 } }, { id: "slot", placement: null }],
  });
  assert.equal(rendered.frame.y, "down");
  assert.equal(rendered.frame.convertedFrom, "up");
  assert.equal(rendered.anchors[0].y_mm, 20);
  assert.equal(rendered.anchors[1].y_mm, null);
  assert.equal(rendered.components[0].placement.y_mm, 26);
  assert.equal(rendered.components[1].placement, null);
});

test("compatibility is an explicit boards list", () => {
  assert.equal(fitsBoard({ boards: ["zero-w"] }, "zero-w"), true);
  assert.equal(fitsBoard({ boards: ["zero-w"] }, "zero-2-w"), false);
  assert.equal(fitsBoard({}, "zero-w"), false);
  assert.deepEqual(mismatch({ boards: ["zero-w"] }, "zero-wh"), ["zero-w"]);
  assert.equal(mismatch({ boards: ["zero-w"] }, "zero-w"), null);
});

test("WH models would start soldered, and the Zero W starts bare", async () => {
  const catalog = await loadCatalog(root);
  const base = catalog.boards.base.models;
  assert.equal(initialHeader(base.find((model) => model.id === "zero-w")), "bare");
  assert.equal(initialHeader(base.find((model) => model.id === "zero-wh")), "solder");
  assert.equal(initialHeader(base.find((model) => model.id === "zero-2-wh")), "solder");
  assert.equal(catalog.board.headerDefault, "bare");
  for (const item of [...catalog.parts, ...catalog.builds, ...catalog.lessons]) {
    assert.deepEqual(item.boards, ["zero-w"]);
  }
});
