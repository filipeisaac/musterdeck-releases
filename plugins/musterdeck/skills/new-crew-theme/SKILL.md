---
name: new-crew-theme
description: Create, review, validate and ship a Crew theme for MusterDeck. Use when asked to build, rework or review a Crew theme, a crew kit, a building catalogue, an arrival point or a world for the MusterDeck Crew view, or to produce the review artifact for one. Covers designing in words first, the rig and ground measurements a theme is authored against, fitting a kit to the real skinned body in motion, the verification ladder, and the four-tab review artifact built on the shipping engine.
---

# Building a Crew theme

A Crew theme is **one JSON descriptor**. Drop it in `<dataDir>/themes/<id>/theme.json` and
the app picks it up with no rebuild (**Reload themes** in the Crew's view menu); ship it in
`src/renderer/public/crew/themes/` (listed in `index.json`) and it travels with the app. It
decides the crew's kit and colours, the buildings, the arrival point, the worlds, the sky,
the zone palette and the words on the status pills. The built-in `colony` is the same
thing written as source (`SPACE_COLONY` in `core/theme.js`).

This skill is the **process**. These carry the detail:

| File | Read it |
| --- | --- |
| `references/descriptor-keys.md` | for every descriptor key (the repo's `docs/crew-themes.md`, shipped) |
| `references/measurements.md` | before authoring anything worn or anything that stands on a plot |
| `references/lessons.md` | the topic you are about to work in, BEFORE you start it: every entry is a fault that validated, loaded, threw nothing and looked wrong |
| `references/artifact-spec.md` | before building the review page |

---

## Rule zero: you cannot judge this by reading it

A theme is geometry and colour. Almost every mistake this process has recorded produced
JSON that validated and looked wrong, or looked like nothing. So:

- **Look at renders, in a loop, on the REAL body, moving.** `/figure.html` (below) draws
  the three ranks on the app's own renderer and the real skinned mannequin, posed by clip
  and time. A still of the bind pose, or the review's stick proxy, hides the faults a
  reviewer sees first: a hem swinging off a skirt, a boot the foot swings out of, a hammer
  held along the forearm.
- **Do not guess a number you can measure.** The rig and the ground are measured in
  `references/measurements.md`. Guessing the body put half the first armour inside it;
  guessing the ground hung the big recipes over their zone. Both looked like colour
  mistakes, which is why neither was caught by looking.
- **Before you render a placement, compute where it lands.** Ten lines printing a world
  position settle in a second what a render cycle settles in two minutes, and they say
  WHY. **A side view is a projection, not a measurement**: when a render says something is
  wrong about depth, compute it before you touch it.
- **When you find a class of fault, sweep for the rest of it** in the same pass, across
  every rank and every theme that shares the construction.

## Two ways this starts

**You were handed a theme id and a folder.** The Crew's **New theme...** row creates
`<data dir>/themes/<id>/` with a working starter `theme.json` and opens a session IN that
folder running `/new-crew-theme <id>`. The folder IS the theme and every edit is live: do
not re-ask for the id, skip step 2's scaffolding, start at step 1 and go straight to the
measurements. "Install" at the end means saving and telling the user to hit **Reload
themes**.

**Somebody asked for a theme in conversation.** Then you own the whole thing: agree what it
says, create the folder under the data dir, and work from there.

## FIRST: which of the two machines are you on?

**Check before you plan anything**, because half of what follows does not exist on one of
them. A theme is runtime data, so an installed app can author one in full -- but the
harness, the generators and the gates live in the MusterDeck repo, and most people who
click **New theme...** do not have it.

Look for `tools/crew-sheet/` above the theme folder, or ask. Then:

| | **With a checkout** | **Installed app only** |
| --- | --- | --- |
| Author the descriptor | yes | yes -- `references/descriptor-keys.md` is the whole key list |
| See it | the harness, then the app | **the app**: save, **Reload themes** in the Crew's view menu, look |
| Generate a kit or catalogue | `evolve/*.py` | hand-written JSON, or ask the user for a checkout |
| `/figure.html`, `/probe.html`, `crewgeom`, `crewpose` | yes | **no** |
| `npm run typecheck`, `npx vitest run`, the palette gates | yes | **no** |
| The review artifact (`review/build.py`) | yes | **no** -- show the theme in the app instead |
| Ship it inside the app | yes | no; the theme folder IS the deliverable |

**On an installed app, say so once, plainly, and then get on with it.** "I cannot run the
rig checks here, so we will judge this in the Crew itself; that is slower per look and
catches less, and if you have the MusterDeck repo I can use the harness instead." Do not
pretend to run a gate, and do not stop: everything in steps 1 to 5 is authoring, and the
loop of save, **Reload themes**, look is a real loop. What you lose is the rungs that
catch what the eye does not -- so lean harder on `references/measurements.md` and compute
placements before you render them (rule zero), because that is now the only thing standing
between a guess and a fault nobody sees.

## The toolkit

**This whole section needs a checkout of the MusterDeck repo.** Skip it if you are on an
installed app; your loop is the app itself, step 6 rung 5.

Run the harness from the repo root: `npx vite --config tools/crew-sheet/vite.config.js`
(port 5199). It serves the renderer's own engine against the app's own assets.

| Tool | What it is for |
| --- | --- |
| `/figure.html?theme=<id>` | **Where fit and motion are judged.** Three ranks on the real rig. `FIG.strip({ clip, status, times, yaw, zoom, focus })` returns a frame strip, `FIG.tryParts([...])` swaps parts live, `FIG.dumpRig()` writes the bone table to `out/rig.json` |
| `/probe.html` (or `node scripts/run-probe.mjs`) | a real `Crew`, 33 threads, 240 frames, then a live switch through every theme. The only rung that reaches the frame loop |
| `/bones.html`, `measure-feet.mjs` | re-measure the rig if the asset changes |
| `evolve/<theme>*.py`, `examples/build-*.py` | the generators: every kit and catalogue in the repo is one |
| `evolve/boots.py` | boots built on the foot bones, sized off the real foot |
| `evolve/common.py` | building-generator helpers: `reach`, `staged`, `report` |
| `evolve/crewgeom.py`, `evolve/crewpose.py` | sampled-solid crossing checks, standing and through every clip |
| `review/build.py <id> --publish <dir>` | the review artifact (step 7) |
| `sync-kit.py <id>` | push a kit edit into the harness data without a browser |
| `dump-builtin.mjs` | writes the built-in theme out as `out/colony.json`, so it gets the same tooling |

## The workflow

**The artifact is rendered and approved BEFORE anything is shipped, and what ships on
approval is a theme file to import, not a new build of the app** (unless the engine itself
changed; see step 8).

### 1. Decide what the theme says, in one line

"A working crew on an airless moon." "A castle-town in the hills, at the turn of the
season." "A small working harbour: every repo a berth, every session a hand on watch."
Every later decision is answerable from that sentence and unanswerable without it.

Then the **rank ladder**: tier 0 is every other model, tier 1 is Opus (the one seen most,
so the shape the eye calibrates on), tier 2 is Fable. Ranks differ in SILHOUETTE, carried
by at least two things, one of which survives being seen from behind (a hat is
foreshortened from behind; coat length is not). **Borrow the domain's own answer**: naval
rank (tally, badge, gold leaf, cuff rings, double breast), NASA's commander stripe and hard
upper torso, Escoffier's toque heights. A real trade solved "tell identical people apart at
a distance" with more care than an afternoon of invention will. The third rank may INVERT
rather than escalate (see `lessons.md`, The rank ladder).

### 2. Scaffold the descriptor

The Crew's view menu, **Themes, New theme...**, writes a valid starter, registers it and
opens it. For anything ambitious, start from a shipped theme instead
(`samurai-village.json`, or Harbour's `crew.json`).

- `registerTheme` **refuses** a spec with any validation error and it simply never
  appears. When a theme "does not show up", read the errors first.
- **Settle the `id` now.** The active theme is persisted by id; renaming mid-work drops you
  back to the default on the next boot, silently.
- **Run the palette gates the day you pick the palette**, from the shipped folder
  (`crew-palette-clash.test.ts`, `crew-status-colour.test.ts`), not at release.

### 3. Design and build the crew

**Say what each rank IS in one sentence before any geometry**, and what carries the
difference. The sentence is what you check the render against. Author the kit as a
**generator** (`evolve/harbour_crew2.py` and `evolve/colony_crew.py` are the current
models): measured numbers in, every placement computed, the hard-to-see constraints
`assert`ed, the words kept next to the geometry.

**First decision: keep the mannequin, or drop it.** `crew.body.drop` decides, and the two
lead to opposite answers at every joint:

- **Keep it** (the colony, samurai, jedi). The mannequin is a skinned spacesuit that bends
  smoothly at every joint. Put rigid pieces only where the body does NOT bend, fitted to
  the measured limb, and let the mannequin do the bending between them. Never lay a rigid
  piece over a bending part: a lower torso shell over the belly, a band inside the arm, a
  glove smaller than the mitten it covers.
- **Drop it** (Harbour, the kitchen). The kit IS the body. Every joint then needs covering,
  and the open tops of the thigh meshes need closing (a seat on `hips`).

**Joints, whichever you chose.** Every kit piece is rigid on one bone and the body bends
between bones, so every meeting of two bones is a seam that opens in motion. Two tools:

- **A sphere on the joint's PIVOT** looks the same at every angle, so pieces on both bones
  sink into it and never gap. Ankle, knee, elbow, shoulder and hip pivots are in
  `measurements.md`. The shoulder pivot is INSIDE any torso shell, so a shoulder sphere is
  also what gives the arm one fixed exit point.
- **Cut a garment where the body bends.** Chest against hips moves 30 degrees in `work` and
  `hit` about a point high in the chest: a coat hung whole off `chest` swings its hem 0.25
  off the skirt. Upper half on `chest`, lower half on `hips` running up inside it, and
  something on the hips proud of both over the seam (a belt, a waist bearing), or a
  mannequin belly that bends on its own. Finish a shell's edge with a rolled rim so it
  reads as a closure, not a cut.

**Feet.** The mannequin's foot is a moon boot 0.24 by 0.39 on a shin only 0.149 long, and
the ankle bends 45 degrees in the walk. A boot on `lowerleg` straddles the ankle and the
foot swings out of it. Use `evolve/boots.py`: shaft on the shin, sphere on the ankle pivot,
vamp and sole on `foot`, toe cap on `toes`, all sized off the real foot.

**Garments.**
- A garment on a round body is a TURNED form: a tapered barrel plus a squashed-sphere
  shoulder, and every panel on it an `arc` at the body's radius. A flat box meets a round
  body at one x and stands off it everywhere else. `LatheGeometry`/`arc` angle 0 is +Z.
- No CLOSED skirt below world y 0.43 survives a walk. Longer than that is side PANELS on
  `hips`, vented fore and aft.
- Armour ENCLOSES the torso (0.72 by 0.53), it does not sit inside it.
- A belt lies ON the coat (an arc at the coat's radius), never a hoop standing off it.
- `stretch` applies AFTER `rotate`; only a torus has a reason to be stretched after it is
  turned.

**The head and the face.** The `face` patch (head-local y 0.215 to 0.625, x ±0.33, on +Z)
is the only thing on the figure that says what a session is doing, and it is driven by the
engine for every theme. Nothing may cross it; a helmet is a cap starting above it, closing
the gap down to it, and enclosing the BACK of the skull. A hat grips at its own lowest edge
and may not be wider than the head there. A feature that lands inside a covering moves ONTO
the covering. Hair, beards, masks, visors: `lessons.md` has one entry each.

**Hands and tools.**
- Every rank declares a WORK tool (`when: "working"`), and it is not a weapon; the
  ceremonial piece goes on `when: "resting"`. A free hand carries something in every state.
- **A tool is held ACROSS the fist: `at: [0, 0.03, 0]`, `rot: [-PI/2, 0, PI/2]`**, with
  the prop built handle-along-+Y and its head across the far END. The old `rot z = PI`
  stood the handle up the forearm and the hammer swung butt first, on three themes.
- Say what this world's people DO when busy. The work clip is a two-handed swing; for the
  Enclave it became a Force-lift, not a lightsabre used as a hammer.

**Colour.**
- Status is `crew.look[status].trim`, and it matches the app's own status tokens (working
  blue, waiting lime, blocked red, celebrating green, watching violet). A theme renames a
  status, never recolours one; its word leads and the key follows in brackets.
- At least one part per rank is tinted `trim` or (better) `pulseTrim`.
- Effort (`tint: "suit"`) goes on small, high parts: bands, a neck ring, a neckcloth. A
  body, a helmet or an apron in the effort colour reads as a different status across the
  map, whatever the palette gate says. `body.tint: "none"`.

**Look at it, then measure it.** On `/figure.html`, every state for every rank from the
front, the side and behind, with a work swing frame by frame. Then
`CLIPS=walk,work,idle,wave,cheer,hit,run,interact python3 tools/crew-sheet/evolve/crewpose.py <descriptor>`
should report no limb entering or piercing a garment. Calibrate what "clean" costs by
running it on a shipped theme first.

### 4. Design the buildings in words, before a single recipe

A theme needs **7 to 10 buildings**. This step produces PROSE and is reviewed as prose. A
recipe written first gets its stages reverse-engineered out of whatever was built, which is
how a village of young threads read as a building site.

For each building, in this order:

1. **What it is and what it is for.** Its JOB, who uses it, and how it differs from the
   others: a roster is a division of labour. Say whether it is meant to read as ordinary or
   special; the commonest building sets the tone of the whole map, so make it plain on
   purpose.
2. **Stage 1: a complete building of its kind at its smallest honest size.** Could one
   person do this building's job in it tonight, in the rain? Door, roof, glazing, a light,
   whatever the job needs. Six or so pieces, each with a reason.
3. **Four evolutions**, each opening with **what it IS** ("a hut with a lean-to") and
   **why it is an evolution of the one before** (investment in something that already
   worked). If the honest answer is "because it finally has a door", the piece belongs in
   stage 1.

Rules the words have to survive:

- Growth comes from extension and equipment, never re-proportioning: steps are strictly
  additive. A hut extended for twenty years is still a hut, and never becomes the office.
- Pieces that are one object belong in ONE stage (a shelf and its lamps, a jar and its lid).
- Stages 2 to 4 improve the BUILDING; furnishing the plot is what stage 5 is for.
- Keep what matters on the faces the map camera sees: the +Z front and one long side.
- Stage 1 must fit a ring slot (`1.81 / world.scale`) or it is shrunk on six slots of seven.

Then author the catalogue as a generator (`evolve/harbour.py`, `evolve/samurai.py`,
`evolve/colony.py`), with the words in the docstrings. Recipes can mix kit parts and
primitives; a kit building still has to honour stage 1 (see `lessons.md`, Buildings).
Review stages as **contact sheets**, every building at one stage in one frame
(`window.__B.sheet(ids, stages)` on the review page, or `scripts/stage-contact-sheet.mjs`),
because the question asked of stage 1 is comparative.

### 5. Set the world

- `world.scale` from what the theme BUILDS: the height of its most ordinary thing against
  a figure 1.23 tall. Architecture sits near 1.45; a kitchen's furniture near 1.05.
- `world.floor`: plate or soil, and a `tint` (how much of the zone accent reaches the
  floor) of about 0.5 or less; the floor is the largest thing on screen and must not
  out-shout the status.
- Twelve zone accents, clear of every status colour (dE 26) and of each other (dE 20);
  the effort ramp one family climbing. `crew-palette-clash.test.ts` enforces both.
- The zone floor has to read against the world's own terrain, from map height.
- The arrival point: a `ship.recipe` of primitives, or the built-in lander.

### 6. Climb the verification ladder

Each rung catches what the one below cannot. **Rungs 1 to 4 need a checkout**; rung 5 is
the one every machine has, and on an installed app it is the whole ladder -- so run it
oftener, in smaller steps, and from a cold start as well as a switch.

1. **`npm run typecheck` and `npx vitest run`**, with cases for anything new. `tsc` does
   not check the engine (unchecked JS); `crew-engine-undefined-names.test.ts` is the only
   thing between a rename in there and a renderer that throws on the first mouse move.
2. **The generators' own lints**, then `crewgeom` (standing) and `crewpose` (moving).
3. **`/figure.html`**, every state, every rank, the real body.
4. **`/probe.html`**: every part non-zero, per-tier counts as intended, the bone slots you
   meant, and a live switch into the theme and back.
5. **The running app, from the themes folder, WITHOUT a rebuild**: copy `theme.json` into
   `<dataDir>/themes/<id>/`, **Reload themes**, and look. Open it COLD as well as by
   switching in (quit, relaunch, look before touching anything). The data dir is
   `~/Library/Application Support/Claude Conductor` on macOS.

### 7. Build and publish the review artifact, and STOP

**Needs a checkout.** Without one, the review is the app: hand the user the theme folder,
tell them to hit **Reload themes**, and walk them through what to look at, rank by rank
and stage by stage, using the done list below as the script. Then wait for the same
approval.

```bash
python3 tools/crew-sheet/review/build.py <id> --publish <scratchpad>/<id>review
```

That builds the four-tab page described in `references/artifact-spec.md` (the crew on the
real body in every state, every building at every stage with the landing point, the world
and the status flow, and everything together), refuses em dashes, checks the 16 MB limit,
and writes `out/csp-<id>.html`. **Open the CSP copy and exercise every tab first**: the
artifact sandbox refuses `fetch()` of data and blob URLs, and a page that only works
outside it is the failure mode this step exists to catch.

Publish `<scratchpad>/<id>review/index.html` with the Artifact tool, **passing the existing
artifact's `url`** if there is one. Hand over the link and **wait**. Do not commit, do not
install.

### 8. On approval: the file to import, then the repo

1. Put `theme.json` where the user can import it: the themes folder, or a file.
2. If it ships with the app: add it to `src/renderer/public/crew/themes/` and `index.json`,
   update `docs/crew-themes.md` for any key you added **and copy it over
   `skills/new-crew-theme/references/descriptor-keys.md`**, bump `package.json`, commit
   (`feat(crew): ... (0.2.NN)`), and say in the message what the theme is and what failed
   on the way.
3. **Make each generator's DEFAULT output the thing that shipped**, or a plain re-run
   months later reverts it.
4. **If the engine changed** (a new attach bone, a new primitive, a key the evaluator now
   reads), a theme using it cannot load in an older app: that one needs a build and an
   install, which is a release decision, not a way of showing somebody a theme.

---

## Definition of done

**Design**
- [ ] One sentence for the theme, one per rank, and the ladder carried by two things in
      silhouette, taken from a real tradition where one exists.
- [ ] 7 to 10 buildings written up in words and agreed before any recipe: job, a complete
      stage 1, four evolutions that each say what they are and why they follow.

**The crew, on the real body, moving**
- [ ] Looked at on `/figure.html` in every state, every rank, front, side and back, and at
      map size.
- [ ] `crewpose` clean on walk, work, idle, wave, cheer, hit, run and interact, with every
      tolerance explained.
- [ ] No seam opens at any joint: a pivot sphere or a cut garment at every one, and the
      mannequin's own parts (feet, knees, open thigh tops) covered or deliberately shown.
- [ ] Nothing crosses the face in any state; a masked rank still reacts.
- [ ] Every rank holds a work tool across the fist, head striking down, and carries
      something whenever the hand is free.
- [ ] Status colours match the app's tokens and every rank wears `trim` or `pulseTrim`;
      effort only on small, high parts.
- [ ] Something on the figure moves as cloth (`flex`).

**The buildings and world**
- [ ] Every stage 1 does its job tonight, in the rain; no later stage completes a building;
      no object is split across stages; the added volume per stage was measured.
- [ ] Stage 1 fits a ring slot; nothing important is on a face the camera never sees.
- [ ] Palette gates green; the floor reads against the terrain from map height.

**The gates** (the first and third need a checkout; say so rather than ticking them)
- [ ] `npm run typecheck` clean, `npx vitest run` green, `/probe.html` green.
- [ ] Loaded in the running app from the themes folder, cold and switched into.
- [ ] Review artifact built with `build.py --publish`, checked in the CSP copy, published
      (updating the existing one), link handed over.
- [ ] **Approved**, before anything below.
- [ ] `theme.json` is where the user can drop it in; if shipped, it is in `index.json`,
      documented, versioned, committed, and each generator's default reproduces it.

## Reference

Paths under `src/`, `tools/` and `docs/` are in the MusterDeck repo; `references/` ships
with this skill and is there on every machine.

| What | Where |
| --- | --- |
| Every descriptor key | `references/descriptor-keys.md` (repo: `docs/crew-themes.md`) |
| The built-in theme, and the schema it defines | `src/renderer/crew/engine/core/theme.js` |
| The shape vocabulary | `src/renderer/crew/engine/core/shapes.js` |
| The building step evaluator | `src/renderer/crew/engine/world/recipes.js` |
| The worn kit, placed per frame | `src/renderer/crew/engine/agents/astronauts.js` |
| The attach bones, the clips, `body.drop` | `src/renderer/crew/engine/agents/crew.js` |
| Cloth motion | `src/renderer/crew/engine/core/flex.js` |
| Interactions library | `src/renderer/crew/engine/agents/interactions.js` |
| Current generator models | `tools/crew-sheet/evolve/harbour_crew2.py`, `colony_crew.py`, `harbour.py`, `colony.py` |
| The harness | `tools/crew-sheet/README.md` |
| Measurements | `references/measurements.md` |
| Every lesson, by topic | `references/lessons.md` |
| The review artifact | `references/artifact-spec.md`, `tools/crew-sheet/review/` |
