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
