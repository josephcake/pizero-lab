# Changes

Each fix is its own commit on `main`. Screenshots are of the static build served at `/pizero-lab/`.

## Prism

| Fix | Commit | What changed |
| --- | --- | --- |
| Pin and part clicks | `a3b6c31` | Pointer capture starts only after the pointer moves more than 4 px, so a mouse click still reaches the pad. |
| Overlay rings | `eea7bc0` | `.pz-overlay, .pz-overlay *` uses a non-scaling 1.5 px stroke. Rings sit at 0.97 mm. Far zoom drops to 1 px. |
| Help panel and board size | `6057edc` | The margin note stays hidden until a key exists. A 32 px Ask tab remains. The explorer fills the viewport, about 11 px/mm at 1280. |
| Phone layers | `1d08431` | Below 820 px, Layers opens a bottom sheet with the header toggle, layers, legend, and tray. |
| Scale bar | `c83c6c6` | The bar width is 10 × px/mm, so the label is a true 10 mm. |
| `est.` badge | `b77a840` | The pin inspector shows 1.7 / 1.0 mm with an `est.` badge. The board art is not labelled. |
| zh-CN chrome | `7232ae9` | Nav links do not wrap one character per line. Explorer labels, the inspector, and the 390 px tabs use the zh-CN strings. |
| Keyboard | `4423378` | `:focus-visible` uses the focus token. Arrow keys move between pins, Enter inspects, and Skip to board focuses the map. |

Also, while those were in:

| | Commit | |
| --- | --- | --- |
| 44 px targets | `ef0b164` | Phone buttons and the board picker are at least 44 px. |
| Empty routes | `a92b267` | Unknown pages say they are not on the bench. Provisional is one tray caption. The theme control is a sun or moon and follows the system scheme. |
| Lesson step | `8db6afb` | The lesson header shows the track, the step, and a time pill. |

## Live QA

| Fix | Commit | What changed |
| --- | --- | --- |
| Lesson board | `1b01ffb` | A zero-width fit no longer writes a NaN viewBox. The lesson board widget is the real board map. |
| Hammered header | `c7dd731` | Hammered is a thin rail and short press-fit posts. Soldered keeps the full shroud. |
| Colliding labels | `327f86d` | Resistor, power, and gpio-sim fields each sit on their own row. |
| Tray wrapping | `327f86d` | Tray names wrap on spaces, not on a hyphen inside a word. |
| Inky blurb | `0779f51` | A long scraped note becomes one short line, shown once. |
| Lesson lock | `0779f51` | Lessons 2 and 3 open from the list and from a direct link. |
| Favicon | `d87b9b5` | `index.html` links `./favicon.svg`, so the browser does not request `/favicon.ico`. |
| zh-CN labels and tabs | `7232ae9` | Already covered by Prism item 7. |
