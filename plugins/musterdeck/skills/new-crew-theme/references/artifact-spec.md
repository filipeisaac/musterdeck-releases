# The theme review artifact

One page per theme, published as a claude.ai Artifact. It is the review surface: the
thing you hand over instead of describing what you built, the thing somebody opens in six
months to find out what a theme contains, and **the gate a theme passes before it is
shipped, committed or installed anywhere**.

It is built by one script, from a template, against the engine that ships:

```bash
npx vite --config tools/crew-sheet/vite.config.js &              # the harness (port 5199)
python3 tools/crew-sheet/review/build.py <id> --publish <scratch>/<id>review
```

That writes `tools/crew-sheet/out/review-<id>.html` (open it locally), `<scratch>/<id>review/index.html`
(what you publish) and `tools/crew-sheet/out/csp-<id>.html` (the sandbox test, below).
Then publish the `index.html` with the Artifact tool. **Update the existing artifact rather
than publishing a new one**: pass its `url` (`action: "list"` finds it), so the link
somebody already has keeps working.

## What it is made of

| Piece | Where | What it does |
| --- | --- | --- |
| `review/template.html` | the page | four tabs, the stages, the controls, the tables |
| `review/entry.js` | bundled by `build.py` every run | exports the SHIPPING engine: shapes, recipes, kits, the lander, faces, interactions, `Astronauts`, `loadCrew` |
| `viewer.js` | inlined | the part-by-part crew viewer (tab 1, second half) |
| `out/viewer-data.json` | inlined | the attach bones, every baked clip, every theme's kit |
| `out/full.json` | read by `build.py` | the descriptor summary the tables are built from |
| `crew.glb` | embedded, base64 | the real mannequin, for tab 1's live stage |
| any `builtin:` kit a recipe names | embedded, base64 | so kit buildings draw (the colony's `spacebase.glb`) |

Keeping the data current:

- **A new theme is not in the dump until it is dumped.** Run `node scripts/grab-theme-dump.mjs`
  then `python3 tools/crew-sheet/save-dump.py tools/crew-sheet/out/dump.json` once, with the
  harness up. After that, `python3 tools/crew-sheet/sync-kit.py <id>` pushes kit edits in
  without a browser.
- **The bones and clips** come from `FIG.dumpRig()` on `/figure.html`, which writes
  `out/rig.json`; `sync-kit.py` merges it. Re-run it whenever `ATTACH_BONES` changes.
- **The built-in theme** has no descriptor file. `tools/crew-sheet/dump-builtin.mjs` writes
  `out/colony.json` (its header has the two commands).

## The four tabs

1. **Crew.** First, *On the real body, moving*: the three ranks side by side on the real
   skinned mannequin, drawn by the app's own `Astronauts` renderer, with ONE row of states
   (spawning, idle, working, watching, celebrating, blocked, waiting, walking, sleeping,
   and the theme's interactions), spin, slow motion and light. This is where fit is
   judged: a belt, a boot, a knee, a tool in the hand. Below it, the part-by-part viewer:
   the kit on a proxy body, a chip per part to isolate it, the same state row, effort
   swatches. The proxy is for looking at a part, never for judging fit.
2. **Buildings.** Every recipe at every stage (slider, and "Grow 1 to 5"), drawn by the
   shipping `world/recipes.js` with the theme's own atlas, plus the landing point (a
   theme's `ship.recipe`, or the built-in lander from `world/ship.js`), and the catalogue
   table with per-stage step counts. `window.__B.sheet(ids, stages)` renders a contact sheet.
3. **World and flow.** The zone palette, the effort ramp, the floor, the worlds, and the
   status flow: each state in this theme's own words, with its trim colour.
4. **Together.** The crew standing among its buildings on the theme's floor, with toggles
   for world, buildings, crew, light and night, a stage slider, and **Meet** to play the
   theme's interactions. The only view that catches a world that does not go with what
   stands on it.

## Non-negotiables

- **Every number is read out of the descriptor or the live engine**, never retyped.
- **Every shape is drawn by the engine that ships.** No port, no mock-up: a mock-up looks
  like evidence and is not. The page's `three` is the app's version (the import map in the
  template; bump it with `package.json`).
- **It works inside the sandbox.** claude.ai refuses `fetch()` of data and blob URLs, which
  is how GLTFLoader reads everything; `withLocalData` in the template answers those from
  memory. Open `out/csp-<id>.html` and exercise every tab before publishing. The colony's
  buildings rendered locally and not at all in the artifact until this existed.
- **No em dashes** anywhere in the copy (`build.py --publish` refuses them).
- **Under 16 MB** (`--publish` checks). The mannequin is 2.8 MB of it and a kit about 2.

## Checks before publishing

- [ ] `out/csp-<id>.html` opens with a clean console, and tab 1's live stage shows three
      moving figures.
- [ ] Every state button changes the face, the pose and what is in the hand together.
- [ ] Tab 2 draws every recipe at stages 1 and 5, and the landing point.
- [ ] Tab 4 shows crew and buildings; world, light and meet toggles all do something.
- [ ] The three ranks are distinguishable on the live stage without reading the labels.
- [ ] Published with the existing artifact's `url`, and the link handed over.

## Writing the page's copy

- Say what is real and what is a stand-in, next to the thing.
- Say what failed and why the number is what it is. The next author learns more from "the
  hammer was held along the forearm, so it swung butt first" than from any description of
  the finished kit.
- The page follows the viewer's colour scheme: tokens on `:root`, redefined under
  `@media (prefers-color-scheme: dark)` guarded by `:root:not([data-theme="light"])`, and
  again under `:root[data-theme="dark"]`. Wide content scrolls in its own container.

## The older pages

`tools/crew-sheet/build-atlas.py` (every theme, a wall of rendered plates, 12 MB) and
`tools/crew-sheet/build-review.py` (every theme, live, no plates) still build. They are for
comparing themes against each other, not for reviewing one; the gate is the page above.
