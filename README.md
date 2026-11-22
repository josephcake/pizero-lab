# Pi Zero Lab

A learning bench for the Raspberry Pi Zero family. The **Zero W** is the default, and the only model with sourced geometry in this tree. Zero v1.2, v1.3, WH, Zero 2 W and Zero 2 WH are named in `data/boards/_base.json` and stay out of the picker until each has its own file. One model's measurements are never copied onto another.

Where Raspberry Pi's own pages disagree, the Zero W file keeps every claim and leaves the value null.

## Run

The site is static. From `web/`:

```bash
npm install
npx vite build
python3 -m http.server 4765 --directory dist
```

Open http://127.0.0.1:4765/#/

`npm start` still boots the older dev servers (Vite on 4743, catalog on 4742, lab tools on 4741). The pages you ship do not call them. See `PUBLISH.md` for GitHub Pages.

That older command installs the web and catalog dependencies if they are missing, and starts three processes:

| Process | Role | Port |
| --- | --- | --- |
| `web` (Vite + React) | The bench, lessons, builds, and the help panel | 4743 |
| `server` (Node, Express) | Catalog and search. Proxies only the lab tools | 4742 |
| `services/lab/server.py` | Resistor maths, GPIO timing model, power budget, pin check, recommender | 4741 |

Python uses the standard library. No virtualenv is required.

```bash
npm test
```

## How a fact is stored

Hardware lives in `data/`, not in components.

- `data/boards/_base.json` — model registry and the shared y-up frame. No geometry.
- `data/boards/zero-w.flux.json` — the sourced Zero W record
- `data/board.json` — alias of `zero-w`
- `data/pinout.json` — the 40-pin header and the typical functions from the GPIO chapter
- `data/electrical.json` — the currents and voltages the calculators are allowed to use
- `data/parts.json` — tray parts, HATs, prices, compatibility
- `data/bom-rules.json` — extras the bill adds (header kit, Zero camera cable)
- `data/lessons/*.json` — one file per lesson
- `data/builds/*.json` — one file per build
- `data/sources.json` — the URLs those records cite

A missing measurement is `null` plus a note. The workbench will not draw that part. Replacing these files is how a later dataset changes the bench without a component edit.

The board outline is the one figure that is drawn to scale: **65 mm × 30 mm**, corner radius **3 mm**, holes specified **M2.5**. Those numbers are on mechanical drawing RP-008367-DS. The PDF has no text layer. The long straight edge between the fillets was taken as 59 mm (65 − 2×3). The short straight then measures 24 mm, which closes the rectangle at 30 mm. Hole centers and the GPIO origin did not come out of that extract cleanly, so they are null.

## Bench model

World units are millimetres. One reducer in `shared/bench.mjs` owns the bench. `canMount` is the only rule that decides whether a part sticks: it needs a sourced outline, sourced anchors on both sides, matching roles, and a free anchor. A part that `requires_header` also waits until the header is soldered or hammered.

Zoom is not an action. It only changes the SVG `viewBox`, down to 60 px/mm. The scale bar is in millimetres. Edge labels appear after you zoom in.

`setHeader` records bare, soldered, or hammered. It does not draw a header body, because that outline is not in the drawing. Soldering or hammering does add the 2×20 kit to the bill, via `bom-rules.json`. A 15-pin camera adds the Zero camera cable the same way.

The bill is `deriveBom(state)`. Nothing stores a total. Prices use `price_usd`, `price_src`, `price_date`, and `retailer`. A null price is “no sourced price”. The total is `$X + N items unpriced` until every line has a price. This tree does not invent prices.

A build step is text plus an optional action (`mount`, `setHeader`, `remove`). Back and next replay those actions through the reducer. “Load this build onto the board” is the same reducer on the live bench.

## Lessons

Tracks are Beginner, Intermediate, and Advanced. A lesson is a data file: track, prerequisites, minutes, badge, sections, quiz, sources. Sections are markdown or a widget id (`board`, `ohm-calculator`, `logic-level`, `gpio-sim`). Progress and badges sit in `localStorage`.

The three seed lessons are Ohm's law for an LED, 3.3 V versus 5 V, and pull-ups with a button debounce model. The advanced track is empty on purpose.

## Help

Settings stores your own OpenAI or Anthropic key in `sessionStorage`, or in `localStorage` if you tick “Remember on this device”. Forget key clears both. The browser calls the provider directly. The Node process has no key route and does not log request bodies. The system prompt tells the model to cite the records it was given and to mark anything else unverified.

CORS preflight from `http://127.0.0.1:4743` succeeded for both providers on 2026-11-22. No key was available in this environment, so the end-to-end check used a mocked fetch, not a live completion.

## Sources worth reading first

- [GPIO](https://github.com/raspberrypi/documentation/blob/master/documentation/asciidoc/computers/raspberry-pi/gpio-on-raspberry-pi.adoc)
- [Power](https://github.com/raspberrypi/documentation/blob/master/documentation/asciidoc/computers/raspberry-pi/power-supplies.adoc)
- [Zero models](https://github.com/raspberrypi/documentation/blob/master/documentation/asciidoc/computers/zero/zero-models.adoc)
- [Zero W product page](https://www.raspberrypi.com/products/raspberry-pi-zero-w/)
- [Mechanical drawing](https://pip.raspberrypi.com/documents/RP-008367-DS)
- [Schematic, rev 1.1](https://pip.raspberrypi.com/documents/RP-008368-DS)

Bluetooth version and the Wi-Fi wording are flagged in `board.json` because those pages do not match.
