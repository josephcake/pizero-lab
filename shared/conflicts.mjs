const POWER = new Set([1, 2, 4, 6, 9, 14, 17, 20, 25, 30, 34, 39]);
const I2C = new Set([3, 5]);
const SPI_BUS = new Set([19, 21, 23]);

export function pinConflicts(body, catalog) {
  const claims = [];
  const unchecked = [];
  for (const id of body.part_ids || []) {
    const part = (catalog.parts || []).find((item) => item.id === id) || null;
    if (!part) { unchecked.push({ part_id: id, reason: "unknown" }); continue; }
    const pins = part.pins_phys || part.pins;
    if (!pins) { unchecked.push({ part_id: id, reason: "pin map is null" }); continue; }
    claims.push(part);
  }
  const clashes = [];
  for (let i = 0; i < claims.length; i++) {
    for (let j = i + 1; j < claims.length; j++) {
      const pinsB = new Set(claims[j].pins_phys || claims[j].pins || []);
      const shared = (claims[i].pins_phys || claims[i].pins || []).filter((pin) => pinsB.has(pin) && !POWER.has(pin));
      const i2c = shared.filter((pin) => I2C.has(pin));
      const flagged = shared.filter((pin) => !I2C.has(pin) && !SPI_BUS.has(pin));
      const addrsA = new Set(claims[i].i2c_addrs || []);
      const collide = (claims[j].i2c_addrs || []).filter((addr) => addrsA.has(addr));
      if (i2c.length && collide.length) flagged.push(...i2c);
      if (flagged.length) {
        clashes.push({
          a: claims[i].id,
          b: claims[j].id,
          names: [claims[i].name, claims[j].name],
          pins: flagged,
          i2c: collide,
        });
      }
    }
  }
  return {
    conflicts: clashes,
    unchecked,
    note: "I2C is flagged only when addresses collide. SPI MOSI, MISO and SCLK are shared. The same chip-enable pin, and two ID EEPROMs, are conflicts.",
  };
}
