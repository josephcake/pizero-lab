#!/usr/bin/env python3
"""Lab tools for the Zero W bench. Reads the data files. Does not see API keys."""

from __future__ import annotations

import ast
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data"


def load():
    electrical = json.loads((DATA / "electrical.json").read_text())
    parts = json.loads((DATA / "parts.json").read_text())["parts"]
    builds = []
    for path in sorted((DATA / "builds").glob("*.json")):
        builds.append(json.loads(path.read_text()))
    return electrical["limits"], parts, builds


LIMITS, PARTS, BUILDS = load()
try:
    HATS = json.loads((DATA / "hats.json").read_text())["parts"]
except FileNotFoundError:
    HATS = []


def lookup(pid):
    for part in PARTS:
        if part["id"] == pid:
            return part
    for hat in HATS:
        if hat["id"] == pid:
            return hat
    return None


def limit(key):
    row = LIMITS[key]
    return row["value"], row["source"]


def send(handler, code, payload):
    body = json.dumps(payload).encode()
    handler.send_response(code)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.end_headers()
    handler.wfile.write(body)


E12 = (1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2)


def next_e12(ohms):
    """Smallest E12 value at or above ohms. 130 becomes 150."""
    import math
    decade = 10 ** math.floor(math.log10(ohms))
    for scale in (decade / 10, decade, decade * 10, decade * 100):
        for mant in E12:
            value = mant * scale
            if value + 1e-9 >= ohms:
                return int(round(value)) if value >= 10 else round(value, 2)
    return None


def resistor(body):
    v_default, v_src = limit("gpio_high_v")
    pin_max, pin_src = limit("gpio_pin_max_ma")
    combined, comb_src = limit("gpio_combined_max_ma")
    try:
        vf = float(body["vf"])
        i_ma = float(body["i_ma"])
        v = float(body.get("v_gpio", v_default))
        count = int(body.get("count", 1))
    except (KeyError, TypeError, ValueError):
        return 400, {"error": "vf, i_ma, and optional v_gpio must be numbers"}
    warnings = []
    sources = [v_src, pin_src, comb_src, "ohms-law"]
    if i_ma <= 0 or v <= 0 or vf < 0 or count < 1:
        return 400, {"error": "current and voltage must be positive"}
    if i_ma < 5 or i_ma > 10:
        warnings.append({
            "code": "beginner-target",
            "source": pin_src,
            "en": "A beginner target is 5–10 mA per LED. Brighter is not required, and it spends the 16 mA pin budget faster.",
            "zh-CN": "入门目标是每颗 LED 5–10 mA。不必更亮，而且会更快用掉单脚 16 mA 的预算。",
        })
    if abs(v - v_default) > 1e-9:
        warnings.append({
            "code": "not-gpio-high",
            "source": v_src,
            "en": f"The GPIO high in the documentation is {v_default} V. {v} V is not that figure.",
            "zh-CN": f"文档里的 GPIO 高电平是 {v_default} V。{v} V 不是这个数字。",
        })
    if i_ma > pin_max:
        warnings.append({
            "code": "over-pin",
            "source": pin_src,
            "en": f"That current is above the documented {pin_max} mA for one GPIO.",
            "zh-CN": f"这个电流超过了单脚 GPIO 文档中的 {pin_max} mA。",
        })
    if i_ma * count > combined:
        warnings.append({
            "code": "over-combined",
            "source": comb_src,
            "en": f"{count} pins at {i_ma} mA each is {i_ma * count} mA, past the documented {combined} mA combined GPIO budget. Each LED still needs its own resistor on its own pin. This does not compute one shared resistor.",
            "zh-CN": f"{count} 个脚各 {i_ma} mA，合计 {i_ma * count} mA，超过文档中全部 GPIO 合计 {combined} mA。每颗 LED 仍要自己的电阻和自己的脚。这里不算一只共用电阻。",
        })
    sag = {
        "en": "A GPIO output sags below 3.3 V as current rises. On the same page, IOH is at least 17 mA only once the pin has already fallen to 2.3 V, at the 16 mA drive setting. The real LED current comes out a bit lower than this ideal figure. Rounding the resistor up is the safe direction.",
        "zh-CN": "电流变大时，GPIO 高电平会低于 3.3 V。同一页上，IOH 至少 17 mA 的条件是脚电压已经降到 2.3 V（16 mA 驱动档）。真实电流会比这个理想值略低。把电阻往上取到标准值是安全的方向。",
        "source": pin_src,
    }
    per_led = {
        "en": "Several LEDs means one resistor per LED, each on its own GPIO. The ohm value below is for a single LED. N × I is checked against the 50 mA total. A shared resistor is not calculated.",
        "zh-CN": "多颗 LED 是每颗一只电阻、各占一个 GPIO。下面的电阻是单颗的。N × I 拿去和 50 mA 总额比较。不算一只共用电阻。",
    }
    if vf >= v:
        return 200, {
            "ohms": None,
            "e12_ohms": None,
            "e12_ma": None,
            "per_led": per_led,
            "sag": sag,
            "warnings": warnings + [{
                "code": "vf-too-high",
                "source": "ohms-law",
                "en": "The forward voltage is not below the drive voltage, so there is no positive resistor for this LED.",
                "zh-CN": "正向压降不低于驱动电压，这颗 LED 没有正的电阻解。",
            }],
            "sources": sources,
        }
    ohms = (v - vf) / (i_ma / 1000.0)
    e12 = next_e12(ohms)
    e12_ma = (v - vf) / e12 * 1000.0
    return 200, {
        "ohms": round(ohms, 2),
        "e12_ohms": e12,
        "e12_ma": round(e12_ma, 2),
        "count": count,
        "v_gpio": v,
        "vf": vf,
        "i_ma": i_ma,
        "per_led": per_led,
        "sag": sag,
        "warnings": warnings,
        "sources": sources,
        "formula": "(Vgpio - Vf) / I",
    }


def button_call(code):
    """Read a single gpiozero Button(...) call. Do not execute the source."""
    try:
        tree = ast.parse(code)
    except SyntaxError as exc:
        return 200, {"ok": False, "error": f"syntax: {exc.msg}"}
    found = None
    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            return 200, {"ok": False, "error": "imports are not read; paste only the Button call"}
        if isinstance(node, ast.Call):
            name = None
            if isinstance(node.func, ast.Name):
                name = node.func.id
            elif isinstance(node.func, ast.Attribute):
                name = node.func.attr
            if name == "Button":
                found = node
    if found is None:
        return 200, {"ok": False, "error": "no Button() call found"}
    out = {}
    for kw in found.keywords:
        if kw.arg not in {"pin", "pull_up", "bounce_time"}:
            return 200, {"ok": False, "error": f"unsupported argument {kw.arg}"}
        if isinstance(kw.value, ast.Constant):
            out[kw.arg] = kw.value.value
        else:
            return 200, {"ok": False, "error": f"{kw.arg} must be a literal"}
    return 200, {"ok": True, "kwargs": out, "source": "gpiozero-button"}


def simulate(body):
    pull = body.get("pull", "up")
    if pull not in {"up", "down"}:
        return 400, {"error": "pull must be up or down"}
    try:
        bounce = int(body.get("bounce_ms", 0))
        debounce = int(body.get("debounce_ms", 0))
        press_at = int(body.get("press_at_ms", 200))
        release_at = int(body.get("release_at_ms", 500))
        duration = int(body.get("duration_ms", 800))
    except (TypeError, ValueError):
        return 400, {"error": "times must be integers"}
    bounce = max(0, min(bounce, 40))
    debounce = max(0, min(debounce, 80))
    duration = max(50, min(duration, 2000))
    if not (0 <= press_at < release_at <= duration):
        return 400, {"error": "press window must sit inside the trace"}

    def ideal(t):
        pressed = press_at <= t < release_at
        if pull == "up":
            return 0 if pressed else 1
        return 1 if pressed else 0

    edges = [press_at, release_at]

    def raw(t):
        level = ideal(t)
        for edge in edges:
            if edge <= t < edge + bounce:
                # Chatter, then settle on the new level.
                return ideal(edge - 1) if ((t - edge) % 2 == 0) else ideal(edge)
        return level

    samples = []
    last = raw(0)
    stable_for = 0
    debounced = last
    for t in range(duration):
        level = raw(t)
        if level == last:
            stable_for += 1
        else:
            last = level
            stable_for = 0
        if stable_for >= debounce:
            debounced = last
        if t % 2 == 0:
            samples.append({"t": t, "raw": level, "debounced": debounced})
    return 200, {
        "pull": pull,
        "bounce_ms": bounce,
        "debounce_ms": debounce,
        "samples": samples,
        "sources": ["gpio-docs", "gpiozero-button"],
        "note": "This is a timing model of a pull and a software debounce. It is not a SPICE run of the pad.",
    }


def power(body):
    base, base_src = limit("zero_w_typical_active_ma")
    psu, psu_src = limit("zero_w_psu_a")
    supply, supply_src = limit("supply_v")
    hdmi, hdmi_src = limit("hdmi_typical_ma")
    camera, cam_src = limit("camera_typical_ma")
    detect, detect_src = limit("zero_has_undervoltage_detect")
    try:
        usb = float(body.get("usb_ma", 0))
        use_hdmi = bool(body.get("hdmi"))
        use_camera = bool(body.get("camera"))
    except (TypeError, ValueError):
        return 400, {"error": "usb_ma must be a number"}
    if usb < 0:
        return 400, {"error": "usb_ma cannot be negative"}
    total = base + usb
    rows = [{"id": "board", "ma": base, "source": base_src, "note": LIMITS["zero_w_typical_active_ma"]["note"]}]
    if use_hdmi:
        total += hdmi
        rows.append({"id": "hdmi", "ma": hdmi, "source": hdmi_src, "note": LIMITS["hdmi_typical_ma"]["note"]})
    if use_camera:
        total += camera
        rows.append({"id": "camera", "ma": camera, "source": cam_src, "note": LIMITS["camera_typical_ma"]["note"]})
    if usb:
        rows.append({"id": "usb", "ma": usb, "source": None, "note": "Typed by the user. Not a datasheet figure."})
    capacity = psu * 1000
    return 200, {
        "rows": rows,
        "total_ma": total,
        "psu_ma": capacity,
        "supply_v": supply,
        "headroom_ma": capacity - total,
        "over": total > capacity,
        "undervoltage_detect": detect,
        "sources": [base_src, psu_src, supply_src, detect_src],
    }


def on_board(item, board):
    if not board:
        return True
    return board in (item.get("boards") or [])


POWER_PINS = {1, 2, 4, 6, 9, 14, 17, 20, 25, 30, 34, 39}


def conflicts(body):
    wanted = body.get("part_ids") or []
    board = body.get("board")
    claims = []
    unchecked = []
    for pid in wanted:
        part = lookup(pid)
        if part and not on_board(part, board):
            unchecked.append({"part_id": pid, "reason": "not for this board"})
            continue
        if not part:
            unchecked.append({"part_id": pid, "reason": "unknown"})
            continue
        pins = part.get("pins_phys") or part.get("pins")
        if not pins:
            unchecked.append({
                "part_id": pid,
                "reason": "pin map is null in the dataset",
                "source": part.get("source"),
            })
            continue
        claims.append(part)
    clashes = []
    for i, left in enumerate(claims):
        left_pins = set(left.get("pins_phys") or [])
        left_i2c = set(left.get("i2c_addrs") or [])
        for right in claims[i + 1:]:
            shared = {pin for pin in left_pins & set(right.get("pins_phys") or []) if pin not in POWER_PINS}
            addrs = left_i2c & set(right.get("i2c_addrs") or [])
            if shared or addrs:
                clashes.append({
                    "a": left["id"],
                    "b": right["id"],
                    "names": [left.get("name"), right.get("name")],
                    "pins": sorted(shared),
                    "i2c": sorted(addrs),
                })
    return 200, {
        "conflicts": clashes,
        "unchecked": unchecked,
        "note": "Signal pins and I2C addresses are compared. Shared power and ground pins are not a conflict.",
    }


def recommend(body):
    owned = set(body.get("owned") or [])
    board = body.get("board")
    scored = []
    for build in BUILDS:
        if not on_board(build, board):
            continue
        need = list(build.get("part_ids") or [])
        have = [pid for pid in need if pid in owned]
        missing = [pid for pid in need if pid not in owned]
        scored.append({
            "id": build["id"],
            "title": build["title"],
            "have": have,
            "missing": missing,
            "score": (len(have) / len(need)) if need else 0,
            "zero_w": build.get("zero_w"),
            "source": build.get("source"),
        })
    scored.sort(key=lambda row: (-row["score"], row["id"]))
    return 200, {"builds": scored}


ROUTES = {
    "/resistor": resistor,
    "/button": button_call,
    "/gpio": simulate,
    "/power": power,
    "/conflicts": conflicts,
    "/recommend": recommend,
}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        # Keep request lines, never a body, so a mistaken key cannot land in the log.
        print("%s %s" % (self.command, self.path))

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.end_headers()

    def do_POST(self):
        route = self.path.split("?", 1)[0]
        fn = ROUTES.get(route)
        if not fn:
            send(self, 404, {"error": "not found"})
            return
        length = int(self.headers.get("Content-Length", "0") or 0)
        raw = self.rfile.read(length) if length else b"{}"
        if route == "/button":
            try:
                body = json.loads(raw.decode() or "{}")
                code = body.get("code", "")
            except json.JSONDecodeError:
                send(self, 400, {"error": "json"})
                return
            code_status, payload = button_call(code)
            send(self, code_status, payload)
            return
        try:
            body = json.loads(raw.decode() or "{}")
        except json.JSONDecodeError:
            send(self, 400, {"error": "json"})
            return
        status, payload = fn(body)
        send(self, status, payload)


def main():
    server = ThreadingHTTPServer(("127.0.0.1", 4741), Handler)
    print("lab tools on http://127.0.0.1:4741")
    server.serve_forever()


if __name__ == "__main__":
    main()
