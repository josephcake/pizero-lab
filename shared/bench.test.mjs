import test from "node:test";
import assert from "node:assert/strict";
import { canMount, deriveBom, emptyState, formatBom, reducer, replaySteps } from "./bench.mjs";
import { SYSTEM_PROMPT, buildHelpContext } from "./context.mjs";
import { WIDGET_IDS } from "./widgets.mjs";
import { loadCatalog } from "./catalog.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function fixture() {
  return {
    board: {
      anchors: [
        { id: "gpio-footprint", role: "gpio-holes", gender: "hole", mates: ["gpio-header-pins"], x_mm: 3, y_mm: 4, source: "test" },
      ],
    },
    parts: [
      {
        id: "hat",
        name: { en: "Hat", es: "Hat" },
        dims: { w_mm: 10, h_mm: 8 },
        anchors: [{ id: "gpio-pins", role: "gpio-header-pins", gender: "pin", mates: ["gpio-holes"], x_mm: 1, y_mm: 1 }],
        requires_header: true,
        price_usd: 12.5,
        price_src: "https://example.test/hat",
        price_date: "2026-11-22",
        retailer: "Example",
      },
      {
        id: "blank",
        name: { en: "Blank", es: "Blanco" },
        dims: null,
        anchors: null,
        price_usd: null,
      },
      {
        id: "cam",
        name: { en: "Cam", es: "Cam" },
        dims: null,
        needs_zero_camera_cable: true,
        price_usd: null,
      },
      {
        id: "gpio-header-2x20",
        name: { en: "Header", es: "Header" },
        dims: null,
        price_usd: null,
      },
      {
        id: "camera-cable-standard-mini",
        name: { en: "Cable", es: "Cable" },
        dims: null,
        price_usd: 4,
        price_src: "https://example.test/cable",
        price_date: "2026-11-22",
        retailer: "Example",
      },
    ],
    bomRules: [
      { id: "header-kit", when: { header: ["solder", "hammer"] }, add_part_id: "gpio-header-2x20" },
      { id: "zero-camera-cable", when: { part_flag: "needs_zero_camera_cable" }, add_part_id: "camera-cable-standard-mini" },
    ],
    builds: [],
  };
}

test("undimensioned parts stay off the board", () => {
  const catalog = fixture();
  const check = canMount(emptyState(), catalog, {
    partId: "blank",
    hostRef: "board",
    hostAnchorId: "gpio-footprint",
    partAnchorId: "gpio-pins",
  });
  assert.equal(check.ok, false);
  assert.equal(check.code, "undimensioned");
});

test("a dimensioned hat snaps by anchor once a header is recorded", () => {
  const catalog = fixture();
  let state = emptyState();
  const bare = canMount(state, catalog, {
    partId: "hat",
    hostRef: "board",
    hostAnchorId: "gpio-footprint",
    partAnchorId: "gpio-pins",
  });
  assert.equal(bare.code, "needs-header");
  state = reducer(state, { type: "setHeader", method: "solder" }, catalog).state;
  const fitted = reducer(state, {
    type: "mount",
    partId: "hat",
    hostRef: "board",
    hostAnchorId: "gpio-footprint",
    partAnchorId: "gpio-pins",
  }, catalog);
  assert.equal(fitted.error, null);
  assert.equal(fitted.state.mounts[0].x_mm, 2);
  assert.equal(fitted.state.mounts[0].y_mm, 3);
  const again = canMount(fitted.state, catalog, {
    partId: "hat",
    hostRef: "board",
    hostAnchorId: "gpio-footprint",
    partAnchorId: "gpio-pins",
  });
  assert.equal(again.code, "occupied");
});

test("bill adds the header kit and the camera cable, and does not invent prices", () => {
  const catalog = fixture();
  let state = emptyState();
  state = { ...state, jobPartIds: ["cam"], header: "hammer" };
  const bom = deriveBom(state, catalog);
  assert.deepEqual(bom.unpriced_names.sort(), ["Cam", "Header"]);
  assert.equal(bom.priced_usd, 4);
  assert.equal(formatBom(bom), "$4.00 + 2 items unpriced");
  const bare = deriveBom({ ...emptyState(), jobPartIds: ["cam"] }, catalog);
  assert.equal(bare.lines.some((l) => l.partId === "gpio-header-2x20"), false);
});

test("replaying a build is the reducer, and a refused mount does not throw", () => {
  const catalog = fixture();
  catalog.builds = [];
  const build = {
    id: "demo",
    part_ids: ["blank"],
    steps: [
      { id: "a", action: { type: "setHeader", method: "solder" } },
      {
        id: "b",
        action: {
          type: "mount",
          partId: "blank",
          hostRef: "board",
          hostAnchorId: "gpio-footprint",
          partAnchorId: "x",
        },
      },
    ],
  };
  const played = replaySteps(build, 1, catalog);
  assert.equal(played.state.header, "solder");
  assert.equal(played.state.mounts.length, 0);
  assert.equal(played.errors[0].error.code, "undimensioned");
  assert.equal(played.state.jobPartIds.includes("blank"), true);
});

test("help context cites sources and never grows a key field", async () => {
  const catalog = await loadCatalog(root);
  const ctx = buildHelpContext({
    catalog,
    route: "/lessons/ohms-led",
    lang: "en",
    selection: { kind: "pin", physical: 3 },
    bench: emptyState(),
    bom: { priced_usd: 0, unpriced_count: 0, unpriced_names: [], lines: [] },
    conflicts: null,
    step: { kind: "lesson", lessonId: "ohms-led", section: 0 },
  });
  const blob = JSON.stringify(ctx);
  assert.equal(blob.includes("apiKey"), false);
  assert.equal(blob.includes("sk-"), false);
  assert.equal(ctx.records.some((r) => r.kind === "pin" && r.record.physical === 3), true);
  assert.match(ctx.records.find((r) => r.kind === "pin").record.source_record.url, /raspberrypi\.com/);
  assert.match(SYSTEM_PROMPT, /unverified/);
});

test("seed lessons use only registered widgets and real sources", async () => {
  const catalog = await loadCatalog(root);
  assert.equal(catalog.lessons.length, 3);
  const tracks = new Set(catalog.tracks.map((t) => t.id));
  assert.equal(tracks.has("advanced"), true);
  for (const lesson of catalog.lessons) {
    assert.equal(tracks.has(lesson.track), true);
    for (const section of lesson.sections) {
      if (section.kind === "widget") assert.equal(WIDGET_IDS.includes(section.id), true);
    }
    for (const source of lesson.sources) assert.ok(catalog.sources[source], source);
    for (const q of lesson.quiz) {
      assert.ok(q.answer >= 0 && q.answer < q.choices.length);
      assert.ok(catalog.sources[q.source]);
    }
  }
  const advanced = catalog.lessons.filter((l) => l.track === "advanced");
  assert.equal(advanced.length, 0);
});

test("real catalog refuses to draw the Inky and still bills the camera cable", async () => {
  const catalog = await loadCatalog(root);
  const inky = catalog.builds.find((b) => b.id === "inky-dash");
  const played = replaySteps(inky, inky.steps.length - 1, catalog);
  assert.equal(played.state.header, "solder");
  assert.equal(played.state.mounts.length, 0);
  assert.equal(played.errors.some((e) => e.error.code === "undimensioned"), true);
  const bom = deriveBom(played.state, catalog);
  assert.equal(formatBom(bom).endsWith("items unpriced"), true);
  assert.equal(bom.lines.some((l) => l.partId === "gpio-header-2x20"), true);
  const cam = catalog.builds.find((b) => b.id === "motioneye");
  const camBom = deriveBom(replaySteps(cam, 0, catalog).state, catalog);
  assert.equal(camBom.lines.some((l) => l.partId === "camera-cable-standard-mini"), true);
});
