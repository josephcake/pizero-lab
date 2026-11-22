// One-time adapter. Flux files are y-up from the bottom-left.
// Everything the renderer reads is already y-down from the top-left.
// Null geometry is dropped. The antenna is never emitted.

const PAD_D = 1.7;
const DRILL_D = 1.0;

export function adaptPinout(rows) {
  return {
    schema: "pizero.pinout/flux",
    pins: rows.map((row) => ({
      physical: row.phys,
      bcm: row.bcm,
      name: row.name,
      kind: row.type === "power" ? (row.name === "GND" ? "ground" : "power") : row.type === "ground" ? "ground" : "gpio",
      type: row.type,
      default_pull: row.default_pull,
      typical_functions: Object.entries(row.alts || {}).map(([alt, name]) => `${alt} ${name}`),
      alt_matrix: row.alts || {},
      alt_matrix_note: row.alts_src_note || row.note || null,
      note: row.note || null,
      src: row.src || [],
      source: null,
    })),
  };
}

function box(x, y, w, h, boardH) {
  if ([x, y, w, h].some((n) => n == null || Number.isNaN(n))) return null;
  return { x, y: boardH - (y + h), w, h };
}

function point(x, y, boardH) {
  if (x == null || y == null) return null;
  return { x, y: boardH - y };
}

export function adaptFluxBoard(flux, pinRows) {
  const meta = flux.board;
  const H = meta.h_mm;
  const header = flux.header;
  const pin1 = point(header.pin1_mm.x, header.pin1_mm.y, H);
  const evenY = point(header.pin1_mm.x, header.row_y_mm.even_pins_pin2, H);
  const pitch = header.pitch_mm;
  const pins = [];
  for (let n = 1; n <= 40; n++) {
    const col = Math.floor((n - 1) / 2);
    const odd = n % 2 === 1;
    const record = pinRows.find((row) => row.phys === n);
    pins.push({
      physical: n,
      bcm: record?.bcm ?? null,
      name: record?.name || `P${n}`,
      type: record?.type || "gpio",
      x: pin1.x + col * pitch,
      y: odd ? pin1.y : evenY.y,
    });
  }
  const draw = [];
  for (const component of flux.components || []) {
    if (["pcb-antenna", "radio-antenna", "radio", "act-led", "regulator", "crystal", "gpio-header"].includes(component.id)) continue;
    const geom = box(component.x_mm, component.y_mm, component.w_mm, component.h_mm, H);
    if (!geom) continue;
    draw.push({
      id: component.id,
      name: component.name,
      kind: component.id,
      ...geom,
      src: component.src || [],
    });
  }
  const holes = (flux.anchors?.mount_holes || [])
    .map((hole) => {
      const p = point(hole.x, hole.y, H);
      if (!p || hole.d == null) return null;
      return { ...p, d: hole.d };
    })
    .filter(Boolean);
  const headerBox = box(header.outline_mm.x, header.outline_mm.y, header.outline_mm.w, header.outline_mm.h, H);
  return {
    schema: "pizero.board/flux",
    id: "zero-w",
    headerDefault: "bare",
    name: { en: meta.name, "zh-CN": meta.name },
    frame: {
      unit: "mm",
      origin: "top-left after one conversion",
      x: "right",
      y: "down",
      convertedFrom: "up",
      authored: meta.origin,
    },
    outline: {
      w_mm: { value: meta.w_mm },
      h_mm: { value: meta.h_mm },
      corner_radius_mm: { value: meta.corner_radius_mm },
    },
    compare_zero_2w: {
      source: "zero-models",
      different: [
        { topic: { en: "CPU", "zh-CN": "CPU" }, zero_w: "1 GHz single-core 32-bit ARM11", zero_2w: "1 GHz quad-core 64-bit Cortex-A53" },
        { topic: { en: "Software width", "zh-CN": "Software width" }, zero_w: "32-bit only. A 64-bit image will not boot.", zero_2w: "64-bit capable" },
      ],
      ram_note: meta.soc + ". Zero 2 W is a different package.",
    },
    disagreements: [],
    components: (flux.components || []).filter((c) => c.id !== "pcb-antenna"),
    anchors: [
      {
        id: "gpio-pin1",
        role: "gpio-holes",
        gender: "hole",
        mates: ["gpio-header-pins"],
        x_mm: pin1.x,
        y_mm: pin1.y,
        source: "mechanical",
      },
    ],
    draw,
    holes,
    header: { ...headerBox, pins, pitch, padD: PAD_D, drillD: DRILL_D, padEstimate: true },
    read: {
      pin1: header.pin1_mm,
      origin: meta.origin,
    },
  };
}

function shortBlurb(hat) {
  const raw = String(hat.compat_note || "")
    .replace(/^Page:\s*/i, "")
    .replaceAll('"', "")
    .replace(/\s+/g, " ")
    .trim();
  if (!raw || raw.length > 180) {
    const header = /header|solder|hammer|pogo/i.test(raw)
      ? " Needs a soldered or hammered header on the Zero W."
      : "";
    return `${hat.name}.${header}`.trim();
  }
  const sentence = raw.split(/(?<=\.)\s/)[0] || hat.name;
  return sentence.length > 140 ? `${sentence.slice(0, 137).trim()}…` : sentence;
}

export function hatToPart(hat) {
  const dims = hat.dims_mm;
  const p1 = hat.pin1_mm;
  const mountable = !!(dims && dims.w && dims.h && p1 && p1.x != null && p1.y != null);
  const h = mountable ? dims.h : null;
  const blurb = shortBlurb(hat);
  return {
    id: hat.id,
    name: { en: hat.name, "zh-CN": hat.name },
    maker: hat.maker,
    category: hat.category || "hat",
    summary: { en: blurb, "zh-CN": blurb },
    boards: ["zero-w"],
    zero_w: hat.zero_w || "unverified",
    zero_w_note: hat.zero_w_note ? { en: hat.zero_w_note, "zh-CN": hat.zero_w_note } : null,
    dims: mountable ? { w_mm: dims.w, h_mm: dims.h } : null,
    dims_note: mountable ? null : { en: "No sourced outline or pin-1 anchor, so this stays in the tray.", "zh-CN": "没有带来源的外形或 1 号针锚点，所以只留在零件盘。" },
    anchors: mountable
      ? [{
          id: "pin1",
          role: "gpio-header-pins",
          gender: "pin",
          mates: ["gpio-holes"],
          x_mm: p1.x,
          y_mm: h - p1.y,
        }]
      : null,
    requires_header: mountable,
    pins_phys: hat.pins_phys || [],
    i2c_addrs: hat.i2c_addrs || [],
    buses: hat.buses || [],
    price_usd: hat.price_usd,
    price_src: hat.price_src,
    price_date: hat.price_date,
    retailer: hat.retailer,
    product_url: hat.url,
    source: Array.isArray(hat.src) ? hat.src[0] : hat.src,
    src: hat.src,
  };
}
