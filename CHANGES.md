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
| Hammer wording | `111088e` | 12.0 mm is the overall height of Adafruit 3662, not the height above the PCB, because part of each pin presses into the board. The mesh is unchanged. |

## Run 12

The Top view is lit again, and the underside is a list. `zero-w.flux.json` and `pinout.flux.json` were not edited. The 3D chunk is `board3d-CaDLlz3v.js`, 136.90 KB gzip. The main bundle is `index-IGzDIfkx.js`, 177.28 KB gzip.

| Fix | Commit | What changed |
| --- | --- | --- |
| Lights | `02fdbcc` | The key light is in the board group, so the Y-up rotation carries the old Z-up aim. A weaker fill shines from below. On the Top view, bare pads read (172, 145, 63) and grey faces read (104, 110, 117). |
| Test-pad picking | `92325c4` | A bottom disc that has coordinates is pushed to pickables as well as tagged. The click handler is unchanged. |
| Underside record | `2883487` | Test pads are on the bottom, and every position is still null, so nothing new is drawn. Bottom opens an Underside inspector: PP1 5V, PP5 GND, PP6 GND, PP8 3V3, PP9 1V8, no bottom parts, the derived J5 footprint, and the printed marks. |

## Run 13

Flux's signed-off review, on top of `c6dc269`. `data/pinout.flux.json` was not edited. The 3D chunk is `board3d-s-gajkpP.js`, 136.90 KB gzip. The main bundle is `index-CEKnTXdv.js`, 178.10 KB gzip.

| Fix | Commit | What changed |
| --- | --- | --- |
| #1 Pin 1 x | `a82fce7` | Every mountable HAT pin 1 x is 8.37 mm. The Inky mounts at the origin, 65 mm wide, flush with the CSI edge. |
| #2 Shared buses | `67bc103` | I2C pins 3 and 5 conflict only when addresses collide. SPI 19, 21 and 23 stay shared. The same CE pin and two ID EEPROMs still conflict. |
| #3 Pin check | `8c4c009` | What you already own renders clash.conflicts. |
| #4 Resistor warning | `54c4b8b` | A drive voltage above 3.3 V warns that GPIO pins output 3.3 V and are not 5 V tolerant. |
| #5 PWM colour | `98d3e8b` | Pins 12, 32, 33 and 35 are coloured PWM before SPI1. |
| #6 Divider | `93c5fb8` | The logic-level divider is 2.2 kΩ and 3.3 kΩ: 3.0 V at 5.0 V, 3.15 V at 5.25 V. |
| #7 Pi-hole | `22e2ab8` | zero_w is works. The docs list an armv6 pihole-FTL build and a 512 MB minimum. |
| #8 motionEye | `732ad9a` | zero_w is caveat. ARMv6/ARMv7 32-bit needs extra build deps. Heavy on one core is Opinion. |
| #9 One Inky | `14b3569` | parts.json inky-phat is gone. The record is hats.json pimoroni-inky-phat, 65×30×8.5 mm. |
| #10 Inky build | `bf055f2` | The dashboard mounts with host gpio-pin1 and part pin1. Pin 1 is (8.37, 25.23) mm and all 40 pads are drawn. |
| #11 RetroPie | `7968ea8` | The header outline is measured, x 7.11, y 24.0, 50.8 × 5.0 mm. Only the body height is unpublished. |
| #12 Drive widget | `902b7b1` | The pin 11 SPI1 sentence is gone. Pins 27 and 28 are reserved for the HAT ID EEPROM. |
| #13 Radio | `ca0445b` | The live radio function says Wi-Fi 802.11 b/g/n plus Bluetooth 4.1 and BLE. board.json is only the alias. |
| #14 Antenna | `841b4cd` | An Antenna control opens the inspector. Nothing is drawn. The outline is not dimensioned. |
| #15 Stale board | `3499771` | data/boards/zero-w.json is deleted. catalog.mjs loads the flux record. |
| #16 Price | `1e5daa5` | A price shows as $20.00 USD, then the retailer or price source, then the date. |
| #17 microSD | `ab1bc1b` | The card's product_url is null. |
| #18 HAT height | `ff2dc35` | HATs that are not 30 or 56.5 mm tall get pin 1 y = height − 4.77, marked estimate. |
| #19 Power | `b053b89` | The budget has a user-entered + HAT/peripheral mA row. |
| #20 GPS HAT | `07ac797` | zero_w is caveat. GPIO14/15 need a UART config step. Marked Estimate. |
| #21 Pad size | `ea9df3c` | The legend marks the 1.7 mm pad and 1.0 mm drill as est. |
| #22 zh-CN | `ed0876e` | Tracks, bill rules, and the builds' difficulty and link labels use zh-CN instead of es. |
| #23 Underside labels | `d54ede0` `9603fea` | Test pads show PP1, and each J5 pin has one number. |

## Run 14

Lint's live v5 list, on top of `cc3bdd3`. `data/pinout.flux.json` was not edited. L-001, L-003 and L-013 still hold: two Inky boards that share `0x50` conflict, the Inky mounts at the origin with pin 1 at x 8.37, and `parts.json` has no second Inky. The 3D chunk is `board3d-DKWcF-4q.js`, 136.94 KB gzip. The main bundle is `index-CAXH6Nme.js`, 179.41 KB gzip.

| Fix | Commit | What changed |
| --- | --- | --- |
| L-002 Build board | `79f77fa` | The build page uses the Explore board map, so the PCB is no longer black and the millimetre labels no longer run together. |
| L-004 Phone routes | `b3038fb` | More opens a sheet with Parts, Tools, Roadmap and Settings. |
| L-005 中文 | `01e39f6` | Lessons, tools, settings, pin headings, builds and search types have zh-CN. Leftover es is gone. |
| L-006 Phone bench | `3818c4c` | The Layers sheet can switch to Bench and fit a tray HAT. |
| L-007 3D camera | `99955bd` | Resize and a header change keep the orbit. Refit is only the first load and the view buttons. |
| L-008 HAT bench | `7b58216` | Bare pads unmount a fitted HAT. Each tray row fits that part, and Remove takes it off. |
| L-009 L-010 L-011 Resistor | `fec75ad` | Fields validate inline, a decimal comma works, a stale result is cleared, and Vf at or above the drive voltage says the LED cannot light. |
| L-012 Power | `409feee` | A negative or non-numeric USB or HAT current is rejected. |
| L-014 Search | `0d16be2` | Search matches localized title text. A quote is not a wildcard. |
| L-015 Lessons | `30a8543` | Back and Next walk every section, including the board, and the bar can fill. |
| L-016 bounce_time | `4f01ee4` | `1e-3` is 1 ms. Past 80 ms the shown value is the clamp, with a note. |
| L-017 Zoom dock | `d226110` | At 390 the +/− dock sits at the bottom left, off the CSI. |
| L-018 Missing pages | `0f6494a` | A bad part, build or pin shows the not-found card. |
| U-2 Pin page | `7d69d55` | `#/pins/1` reads the same pinout as the inspector. |
| U-1 Pointer | `9d1bb5c` | `releasePointerCapture` runs only when the element still holds the capture. |
| L-019 Checkboxes | `fa8b74b` | The box stays 18 px at the left of the label. |
| L-020 Step wording | `9bbe103` | A failed step uses plain wording. The Inky step places the pHAT. |
| HAT label | `aa2ceb7` | A long mounted name is ellipsized, with the full title on hover. |

## Run 15

v6 polish on `ae5c11c`. `data/pinout.flux.json` was not edited. No current was invented for a HAT. The main bundle is `index-Bmy9hw1g.js`, 178,290 bytes gzip (178.29 KB). The 3D chunk is `board3d-D3-hQjJH.js`, 136,093 bytes gzip (136.09 KB).

| Item | Commit | What changed |
| --- | --- | --- |
| B1 Build board | `32f40b2` | The build-page board is at most 560 px wide, the frame matches 65×36, and the holes stay inside. |
| B2 Inky build | `c55e830` | The flag is works, with the Pinout.xyz sentence and link. The fit step says pin 1 sits on pin 1. |
| B3 Pi-hole | `59b1d3f` | One sentence, a labelled source, and "2 items, unpriced" when nothing has a price. |
| B4 中文 parts | `61426a4` `975efc8` | Camera, the generic tool parts, and the power-result camera are translated. `es` is gone. |
| B5 Power | `61b83e1` | A mounted HAT with no sourced current is labelled and left out of the total. |
| P1 Inspector | `b6ea799` | A pin or part opens the phone sheet to half. The handle is 44 px and named. |
| P2 Tap targets | `0cbe00b` | Layers segments are 44 px tall. 2D and 3D are at least 44 px wide. |
| P3 中文 breaks | `923b7fc` | Body text can break. Nav, buttons, chips and table labels stay whole. |
| P4 Tool labels | `b1c33d8` | Map tool labels are centred in the buttons. |
| P5 Phone forms | `2bb2471` | Inputs are 44 px tall at 16 px. Checkbox and quiz rows match. |
| P6 Bench names | `26140db` | Tray names wrap inside the rail. Silk prints the short name. |
| P7 Mode chip | `fdad64c` | The phone toolbar shows Explore or Bench, whichever is current. |
| P8 中文 controls | `ec6f404` | 电路板, 裸焊盘, 焊接, 压接, 顶视, 底视, 侧视. |
| P9 Learn cards | `347537b` | The card is the tap target. Advanced says the rest are on the way, once. |
| P10 CJK fonts | `08fb1db` | PingFang SC, Hiragino Sans GB, Microsoft YaHei, Noto Sans CJK SC and Source Han Sans SC sit ahead of ui-sans-serif. |
| P-minor | `f26e0ab` | The resistor calculator is an h2, like the other tool headings. Desktop Top is disabled. |
