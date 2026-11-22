# Changes

Run 6 is a chrome pass on v2. `data/*.flux.json` is unchanged. One commit per delta.

| Delta | Commit | What changed |
| --- | --- | --- |
| 1. Explorer shell at 1440 | `016b8c0` | Grid is 280 / map / 360. The rail is eye rows, a legend, and a bench caption. The bill is off the map. A floating toolbar and a 168×84 minimap are in. |
| 2. Explorer at 390 | `0272c26` | The mast is 48 px. The map is full-bleed. The inspector is a snap sheet. The tab bar uses icons. The bill and minimap are hidden. |
| Phone toolbar stays one row | `90d0add` | Explore, Bench, and Layers no longer wrap over the board. |
| 3. Lab step | `1338a17` | A lesson is outline 240 / step 72ch / live bench 440. The title uses the 28/34 face. Check is the one primary action. |
| 4. Board overlays | `3400f6d` | The selected pin gets a callout. Measurements draw the 65 mm and 30 mm ticks. Only that pin and its neighbours are numbered. Function rings fade above 16 px/mm. |
| 5. App bar | `2785a32` | Tabs read Board, Learn, Builds, Parts, Tools. Search no longer says “ledger”. The board picker sits under the wordmark. |
| Scale bar steps with zoom | `c96117c` | The bar uses 1, 2, 5, 10, or 20 mm so it stays between 60 and 140 px. |
| Focus ring on the pin | `2785a32` | `svg.pz-board` no longer draws a focus box. The ring and the name chip stay on the pin. Same stylesheet commit as the app bar. |
| Theme button 44 px on a phone | `2785a32` | At 390 the sun/moon control is 44 px. Same stylesheet commit as the app bar. |

## Skipped

| Delta | Why |
| --- | --- |
| 6. Inspector chips and source lines | Stopped after the scoped five, plus the three leftovers. The fact grid and sources are unchanged. |
| 7. Legend click-to-highlight | The eye row landed in delta 1. Pulsing a pin type did not. |
| 8. Remaining type tokens on every heading | The lesson title uses `--t-h1`. Other pages still inherit the old heading rule. |
| 10. Bottom view and solder close-up | Out of this run with the iron sequence. Bottom and Side stay disabled in the toolbar. |

## Run 7

Checked live after run 6. Three contrast and layout fixes. `data/*.flux.json` is unchanged.

| Fix | Commit | What changed |
| --- | --- | --- |
| Active toolbar text | `ac4feca` | Explore uses the signal fill and the on-signal ink in both themes, on the explorer and the lesson bench. Contrast is 9.96:1 in the dark theme and 5.85:1 in the light theme. |
| Minimap | `1463a53` | The box draws the board outline, the parts, and the viewport rectangle. |
| Board picker | `2901f0b` | The closed label is Zero W, so the select no longer cuts the name. |

## Run 8

A low-poly 3D view on the Board page. `data/boards/zero-w.flux.json` and `data/pinout.flux.json` were not edited. Heights are estimates in `data/boards/zero-w.3d.json`.

Bundle sizes from the production build: main `index-B7UlxkJ6.js` 175.54 KB gzip, 3D chunk `board3d-BBi2BH4M.js` 134.13 KB gzip.

| Step | Commit | What changed |
| --- | --- | --- |
| Heights file | `3c78993` | Every z value is `{value_mm, status: "estimate", source: "pending Flux"}`. |
| 2D/3D toggle | `0d2fc61` | 2D stays the default. 3D is `#/?view=3d`, with the same segmented control as the toolbar. EN and zh-CN strings included. |
| Lazy three.js view | `bc5331e` | Separate chunk: three core plus OrbitControls only. Rounded PCB, four mounting holes, header holes, and low-poly parts from the flux footprints. |
| Header states | `bc5331e` | Bare is plated holes. Soldered adds a black body and long pins. Hammered is shorter pins and no body. |
| Orbit | `bc5331e` | Drag orbits, wheel or pinch zooms, right-drag or two-finger drag pans. Reset, Top, Front, and Side. Zoom is clamped. |
| Picking | `bc5331e` | A click or tap on a pin raycasts into the existing selection. A move past 4 px is not a click. Hover and selection highlight the pin. |
| Mounted pHAT | `bc5331e` | A mounted part with dimensions is a thin board at the estimate standoff. |
| Theme and idle | `bc5331e` | Both themes colour the bench. Flat shading, pixel ratio capped at 2, render only when something changes, dispose on unmount. |
| Keyboard | `bc5331e` | The canvas has an aria-label. Pins can be chosen from the pin list or by switching back to 2D. The inspector does not show the estimate heights. The view says “Heights are estimates.” |

Steps 3–10 share `bc5331e` because they are one viewer module. Shipping them separately would have left a blank canvas on main.

## Run 9

Flux heights replace the placeholders where Flux published a number. `zero-w.flux.json` and `pinout.flux.json` were not edited. The 3D chunk is `board3d-BEXQ988W.js`, 136.32 KB gzip. The main bundle is `index-B766vEIQ.js`, 175.62 KB gzip.

| Fix | Commit | What changed |
| --- | --- | --- |
| Sourced heights | `e1665bb` | CSI is 1.20 mm confirmed. Header body is 2.54 mm derived, the post above it is 5.84 mm confirmed, and the tail below the board is 2.54 mm derived. The hammer header is 12.0 mm overall, confirmed, with no body/pin split. PCB, SoC, microSD, mini-HDMI, and both micro-USBs stay estimates, source “no published height (Flux)”. The pHAT gap is 8.0 mm, spec minimum, from the HAT spec. No RF shield is drawn. |
| Labels and camera fit | `40753b1` | The note is “Grey-outlined parts: estimated heights.” Hover or select on an estimated part shows “est. height”. The pHAT shows “8 mm gap: spec minimum”. Reset, Top, Front, and Side fit the board to both the vertical and horizontal field of view, with about 8% margin, including on a 390×844 portrait screen. |

## Run 10

The 3D camera can look at the back of the board. `zero-w.flux.json` and `pinout.flux.json` were not edited. The 3D chunk is `board3d-DLDYesZI.js`, 136.85 KB gzip. The main bundle is `index-D5xsF7Zq.js`, 175.75 KB gzip.

| Fix | Commit | What changed |
| --- | --- | --- |
| Full orbit | `141ce90` | Polar angle runs from 0 to π, so the camera can sit directly under the board. Pan and zoom clamps stay. Crossing a pole can flip the picture; the range is still 0 to π. |
| Bottom button | `141ce90` | Bottom uses the same fit as the other views, from underneath, with X mirrored. zh-CN uses 底. |
| Underside | `141ce90` | The PCB bottom is the same colour, with the four mounting holes. Bare shows the plated holes. Soldered adds a low-poly joint on each pin and the 2.54 mm tail. Hammered has no solder; a short stub is marked est. and no tail length is claimed. |
| Test pads | `141ce90` | A pad is drawn only when a subpart has x, y, and side bottom. Zero W has no such coordinates, so Bottom says “Test pad positions for the Zero W aren't published.” |
| Hammer wording | `111088e` | 12.0 mm is the overall height of Adafruit 3662, not the height above the PCB, because part of each pin presses into the board. The mesh is unchanged. | |
