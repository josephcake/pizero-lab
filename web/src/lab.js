import electrical from "../../data/electrical.json";
import { pinConflicts } from "../../shared/conflicts.mjs";

const limits = electrical.limits;
const E12 = [1, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2];

function nextE12(ohms) {
  const decade = 10 ** Math.floor(Math.log10(ohms));
  for (const scale of [decade / 10, decade, decade * 10, decade * 100]) {
    for (const mant of E12) {
      const value = mant * scale;
      if (value + 1e-9 >= ohms) return value >= 10 ? Math.round(value) : Math.round(value * 100) / 100;
    }
  }
  return null;
}

export function labCall(tool, body, catalog) {
  if (tool === "resistor") return resistor(body);
  if (tool === "conflicts") return pinConflicts(body, catalog);
  if (tool === "power") return power(body);
  if (tool === "recommend") return recommend(body, catalog);
  if (tool === "gpio") return gpio(body);
  if (tool === "button") return button(body);
  throw new Error("unknown tool");
}

function parseLoose(value) {
  if (value == null) return null;
  const text = String(value).trim().replace(/\s/g, "").replace(/,/g, ".");
  if (!text) return null;
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)) return NaN;
  const number = Number(text);
  return Number.isFinite(number) ? number : NaN;
}

function resistor(body) {
  const v = parseLoose(body.v_gpio ?? limits.gpio_high_v.value);
  const vf = parseLoose(body.vf);
  const i = parseLoose(body.i_ma);
  const count = parseLoose(body.count ?? 1);
  const fields = {};
  if (vf == null || Number.isNaN(vf) || vf < 0) fields.vf = "bad";
  if (i == null || Number.isNaN(i) || !(i > 0) || i > 1000) fields.ma = "bad";
  if (v == null || Number.isNaN(v) || !(v > 0) || v > 24) fields.volts = "bad";
  if (count == null || Number.isNaN(count) || !Number.isInteger(count) || count < 1 || count > 40) fields.count = "bad";
  if (Object.keys(fields).length) return { ok: false, fields, warnings: [] };
  const warnings = [];
  if (v > 3.3) warnings.push({ code: "gpio-3v3", en: "GPIO pins output 3.3 V and are not 5 V tolerant.", "zh-CN": "GPIO 输出 3.3 V，不耐 5 V。" });
  if (i < 5 || i > 10) warnings.push({ code: "beginner-target", en: "A beginner target is 5–10 mA per LED.", "zh-CN": "入门目标是每颗 LED 5–10 mA。" });
  if (i > limits.gpio_pin_max_ma.value) warnings.push({ code: "over-pin", en: `Above ${limits.gpio_pin_max_ma.value} mA on one pin.`, "zh-CN": `超过单脚 ${limits.gpio_pin_max_ma.value} mA。` });
  if (i * count > limits.gpio_combined_max_ma.value) warnings.push({ code: "over-combined", en: `${count} × ${i} mA exceeds the ${limits.gpio_combined_max_ma.value} mA GPIO total. Each LED keeps its own resistor.`, "zh-CN": `${count} × ${i} mA 超过全部 GPIO 合计 ${limits.gpio_combined_max_ma.value} mA。每颗 LED 仍用自己的电阻。` });
  const sag = { en: "A GPIO high sags as current rises. IOH is specified at 2.3 V, so the real current is a bit lower. Rounding the resistor up is the safe direction.", "zh-CN": "电流变大时高电平会低于 3.3 V。真实电流会略低。把电阻往上取是安全的。" };
  const per_led = { en: "One resistor per LED, each on its own pin. N × I is checked against 50 mA. No shared resistor.", "zh-CN": "每颗 LED 一只电阻、一个脚。N × I 对照 50 mA。不算共用电阻。" };
  if (vf >= v) {
    warnings.push({ code: "vf-high", en: "The LED cannot light at this drive voltage.", "zh-CN": "这个驱动电压点不亮这颗 LED。" });
    return { ok: true, ohms: null, e12_ohms: null, e12_ma: null, warnings, sag, per_led, formula: "(Vgpio - Vf) / I" };
  }
  const ohms = (v - vf) / (i / 1000);
  const e12 = nextE12(ohms);
  if (e12 == null || !Number.isFinite(e12) || e12 <= 0) return { ok: false, fields: { ma: "bad" }, warnings: [] };
  const e12Ma = ((v - vf) / e12) * 1000;
  if (!Number.isFinite(e12Ma)) return { ok: false, fields: { ma: "bad" }, warnings: [] };
  return { ok: true, ohms: Math.round(ohms * 100) / 100, e12_ohms: e12, e12_ma: Math.round(e12Ma * 100) / 100, warnings, sag, per_led, formula: "(Vgpio - Vf) / I" };
}

function power(body) {
  const base = limits.zero_w_typical_active_ma.value;
  let total = base;
  const rows = [{ id: "board", ma: base, note: limits.zero_w_typical_active_ma.note }];
  if (body.hdmi) { total += limits.hdmi_typical_ma.value; rows.push({ id: "hdmi", ma: limits.hdmi_typical_ma.value, note: limits.hdmi_typical_ma.note }); }
  if (body.camera) { total += limits.camera_typical_ma.value; rows.push({ id: "camera", ma: limits.camera_typical_ma.value, note: limits.camera_typical_ma.note }); }
  const fields = {};
  const usbParsed = parseLoose(body.usb_ma ?? 0);
  const hatParsed = parseLoose(body.hat_ma ?? 0);
  if (usbParsed == null || Number.isNaN(usbParsed) || usbParsed < 0) fields.usb = "bad";
  if (hatParsed == null || Number.isNaN(hatParsed) || hatParsed < 0) fields.hat = "bad";
  if (Object.keys(fields).length) return { ok: false, fields };
  const usb = usbParsed;
  if (usb) { total += usb; rows.push({ id: "usb", ma: usb, note: "Typed by the user." }); }
  const hat = hatParsed;
  if (hat) { total += hat; rows.push({ id: "hat", ma: hat, note: "User-entered." }); }
  const psu = limits.zero_w_psu_a.value * 1000;
  return { rows, total_ma: total, psu_ma: psu, supply_v: limits.supply_v.value, headroom_ma: psu - total, over: total > psu, undervoltage_detect: limits.zero_has_undervoltage_detect.value };
}

function recommend(body, catalog) {
  const owned = new Set(body.owned || []);
  const builds = catalog.builds.filter((build) => (build.boards || []).includes(body.board)).map((build) => {
    const need = build.part_ids || [];
    const have = need.filter((id) => owned.has(id));
    return { id: build.id, title: build.title, have, missing: need.filter((id) => !owned.has(id)), score: need.length ? have.length / need.length : 0, zero_w: build.zero_w, source: build.source };
  });
  builds.sort((a, b) => b.score - a.score);
  return { builds };
}

function gpio(body) {
  const pull = body.pull === "down" ? "down" : "up";
  const bounce = Math.max(0, Math.min(40, Number(body.bounce_ms || 0)));
  const debounce = Math.max(0, Math.min(80, Number(body.debounce_ms || 0)));
  const press = Number(body.press_at_ms ?? 180);
  const release = Number(body.release_at_ms ?? 460);
  const duration = Number(body.duration_ms ?? 700);
  const ideal = (t) => {
    const pressed = t >= press && t < release;
    return pull === "up" ? (pressed ? 0 : 1) : (pressed ? 1 : 0);
  };
  const raw = (t) => {
    let level = ideal(t);
    for (const edge of [press, release]) {
      if (t >= edge && t < edge + bounce) level = ((t - edge) % 2 === 0) ? ideal(edge - 1) : ideal(edge);
    }
    return level;
  };
  const samples = [];
  let last = raw(0);
  let stable = 0;
  let debounced = last;
  for (let t = 0; t < duration; t++) {
    const level = raw(t);
    if (level === last) stable += 1;
    else { last = level; stable = 0; }
    if (stable >= debounce) debounced = last;
    if (t % 2 === 0) samples.push({ t, raw: level, debounced });
  }
  return { samples };
}

function button(body) {
  const code = String(body.code || "");
  if (!/Button\s*\(/.test(code)) return { ok: false, error: "no Button() call found" };
  const kwargs = {};
  const bounce = code.match(/bounce_time\s*=\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/);
  const pull = code.match(/pull_up\s*=\s*(True|False)/);
  if (bounce) {
    const seconds = Number(bounce[1]);
    const ms = Math.round(seconds * 1000);
    const clamped = Math.max(0, Math.min(80, ms));
    kwargs.bounce_time = clamped / 1000;
    kwargs.bounce_ms = clamped;
    kwargs.bounce_clamped = clamped !== ms;
  }
  if (pull) kwargs.pull_up = pull[1] === "True";
  return { ok: true, kwargs, source: "gpiozero-button" };
}
