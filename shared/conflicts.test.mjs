import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadCatalog } from "./catalog.mjs";
import { pinConflicts } from "./conflicts.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

test("I2C is shared unless the addresses collide, and one CE line is not", async () => {
  const catalog = await loadCatalog(root);
  const clear = pinConflicts({ part_ids: ["pimoroni-inky-phat", "pimoroni-scroll-phat-hd"] }, catalog);
  assert.equal(clear.conflicts.length, 0);
  const same = pinConflicts({ part_ids: ["pimoroni-inky-phat", "pimoroni-inky-what"] }, catalog);
  assert.equal(same.conflicts.length, 1);
  assert.deepEqual(same.conflicts[0].i2c, ["0x50"]);
  assert.ok(same.conflicts[0].pins.includes(3));
  assert.ok(same.conflicts[0].pins.includes(24));
  assert.equal(same.conflicts[0].pins.includes(19), false);
  assert.equal(same.conflicts[0].pins.includes(23), false);

  const eeprom = {
    parts: [
      { id: "a", name: { en: "A" }, pins_phys: [27, 28], i2c_addrs: [] },
      { id: "b", name: { en: "B" }, pins_phys: [27, 28], i2c_addrs: [] },
    ],
  };
  const id = pinConflicts({ part_ids: ["a", "b"] }, eeprom);
  assert.deepEqual(id.conflicts[0].pins, [27, 28]);
});
