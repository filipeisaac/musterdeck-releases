# Writing a Crew theme

A theme decides what the Crew view looks like: the world it stands on, the buildings, the
crew and what they wear, where they arrive, the sky, the palette, and the words on the
status pills.

**A theme is a folder with a `theme.json` in it.** Adding one needs no rebuild and no
restart of anything but the Crew view. Switching between them is live.

> This file also SHIPS WITH THE APP, as `references/descriptor-keys.md` inside the
> `new-crew-theme` skill, so somebody writing a theme from an installed MusterDeck has the
> key list without a checkout of this repo. The two copies are kept identical by
> `tests/unit/main/bundled-skill-docs.test.ts` -- edit this one and copy it across.

```
<data dir>/themes/
  my-village/
    theme.json
    kit.glb          (optional)
```

The data directory is `~/Library/Application Support/Claude Conductor` on macOS,
`%LOCALAPPDATA%/MusterDeck` on Windows, `~/.claude-conductor/data` on Linux.

**You do not have to find that folder yourself.** The Crew's view menu (the sliders on
the rail) has a **Themes** block with three rows:

| Row | What it does |
| --- | --- |
| **New theme…** | Asks for an id, writes a working starter `theme.json`, opens the folder, and registers it so it is in the Theme picker immediately. |
| **Themes folder** | Opens the folder in Finder or Explorer. |
| **Reload themes** | Re-reads the folder and re-registers everything in it, without leaving the view. |

`Reload themes` is what makes the folder a workspace: edit a `theme.json`, hit Reload, pick
it from the **Theme** row. No rebuild, no restart, no remount. A theme that fails validation
is reported there rather than silently vanishing from the picker.

The starter is deliberately four lines of content. Everything it does not mention is
inherited from the built-in, so it renders as a working crew from the moment it is
created and you change it a piece at a time.

## The smallest useful theme

Everything you leave out is inherited from the built-in **Crew** theme. A palette and a
few words is a legal theme:

```json
{
  "id": "my-village",
  "name": "My Village",
  "blurb": "Somewhere else entirely.",
  "planets": ["terra", "mars"],
  "status": { "waiting": "On the pass", "celebrating": "Served" },
  "plotPalette": ["#c96442", "#4f9a63", "#4f7ec9"],
  "hud": { "accent": "#c96442" }
}
```

The folder name is the id. If the two disagree, the folder wins, because two themes can't
share a folder and a file whose id disagrees with its folder makes "which one did I just
edit" unanswerable.

Colours are `#rgb`, `#rrggbb`, or a number. Anything unreadable falls back to the built-in
value rather than failing.

## What a theme can set

| Key | What it paints |
| --- | --- |
| `planets` | Which worlds this theme offers, first is the default. Ids from `worlds` below, or the three built in: `moon`, `mars`, `terra`. |
| `worlds` | **Worlds of your own**, keyed by id. Ground, rock, horizon, sky, fog, sun, ambient, atmosphere, craters, roughness, scatter, companion, dust. See below. |
| `scatters` | **Planting lists of your own**, by the name a world's `scatter` refers to. |
| `status` | The words on the status pills. The eight KEYS are the status vocabulary and are not yours to change; the strings are. |
| `plotPalette` | One accent per zone, picked by hashing the repo name. **Order matters**: a zone's accent is `palette[hash(name) % length]`. |
| `crew.look.<state>` | `trim` and `eye` per state, for **`idle`, `sleeping` and `leaving` only**. `working`, `waiting`, `blocked`, `celebrating` and `spawning` are the app's own `--status-*` colours and a theme's values for them are ignored: a status means the same thing in every world, and the same trim paints the building's work-site cord. Keep at least one eye channel above 1.0 or the bloom pass stops catching it and the glow dies at night. |
| `crew.suitTones` | Fallback suit colours, by id hash, when effort is unknown. |
| `crew.effortTones` | `low` `medium` `high` `xhigh` `max` `ultracode`. |
| `crew.effortUnknownTone` | Effort the statusline has not confirmed. Assert no temperature here. |
| `crew.scale` | How tall the character stands. |
| `crew.body` | The mannequin's own surface, and whether the per-agent colour lands on it at all. Set `"tint": "none"` for anything wearing armour. See below. |
| `crew.parts` | **The worn kit.** Hats, masks, armour, banners, tools, cloth that moves. See below. |
| `hud` | `accent` `green` `blue` `amber` `red` `teal`. Written onto the mount as CSS custom properties. |
| `sky` | `nightFloor` `duskThick` `duskThin` `fill`. The only four sky colours that are not the planet's. |
| `ship.surfaces` | The arrival point's paint, by role. A recipe names these with `paint`. |
| `ship.recipe` | **The arrival point itself.** A gate, a dock, a portal. See below. |
| `ship.door` | Where the crew appear and vanish, in its own frame. |
| `ship.lights` | RGB **triples**, not hexes: each is multiplied by a per-frame scalar. Channels above 1.0 are what the bloom pass catches. |
| `buildings` | `scaffold`, and `fallbackAccent` for a building with no zone. |
| `world` | Where geometry comes from, and what is built out of it. See below. |

One thing a theme deliberately cannot change:

- **The crew rig.** The body is one mannequin. Its bone names, its animation clips and the
  walk cycle are a rig contract, not a costume, so you cannot swap the skeleton. You can
  paint its surface (`crew.body`) and replace everything WORN over it, on any of nine
  attach bones, which together are enough to armour a body rather than decorate one. The
  mannequin's own head is dropped by the rig, so a kit with no head part leaves a headless
  body: give it one.

And one place this deliberately leaves a second path: the **built-in lander** has no
`ship.recipe` and stays geometry in `world/ship.js`. Its legs are solved from where the
foot has to land so the strut, the footpad and the ground all agree, and transcribing that
trigonometry into thirty literal steps would risk a good asset for no visible gain. Set a
recipe and you get yours instead.

## Worlds

A theme can define the ground it stands on. Same shape as the three built-in planets:

```json
"planets": ["yamato"],
"worlds": {
  "yamato": {
    "id": "yamato", "name": "Yamato", "blurb": "Green hills, cedar and pine.",
    "ground": { "low": "#3c5a2c", "high": "#7ea34e", "tint": "#9ec46a" },
    "rock": "#7d786c",
    "horizon": "#a8bcc4",
    "sky": { "top": "#2f6aa8", "bottom": "#cfe0ea" },
    "fog": { "color": "#a3b8c0", "near": 96, "far": 242 },
    "sun": { "color": "#fff4dc", "intensity": 2.5, "night": 0.14 },
    "ambient": { "sky": "#a8cbe0", "ground": "#485c32", "intensity": 1.0 },
    "atmosphere": 1, "craters": 0, "roughness": 0.8,
    "scatter": "grove",
    "companion": { "name": "Tsuki", "color": "#f2ead6", "size": 3.6, "glow": "#fff8e4" },
    "dust": 0.3
  }
}
```

`atmosphere` (0 to 1) drives how much the sky scatters, whether stars wash out by day and
how strongly `sky.duskThick` tints the horizon at golden hour. `craters` and `roughness`
shape the terrain. `companion` is the big body hanging in the sky. An id matching a
built-in shadows it, so you can retune `terra` rather than describe a new world.

Naming a world you have not defined is refused rather than rendering a crew with no
ground.

### What grows on it

`scatters` are lists keyed by the name a world's `scatter` refers to, merged over the
built-in `flora` and `rocks`:

```json
"scatters": {
  "grove": [
    { "part": "Tree_1_A_Color1", "weight": 4, "size": [0.4, 0.72], "sink": 0.02, "upright": true },
    { "part": "Grass_2_D_Color1", "weight": 6, "size": [0.6, 1.35], "sink": 0.05, "upright": true },
    { "part": "Rock_1_D_Color1", "weight": 2, "size": [0.4, 0.9], "sink": 0.3, "tint": true }
  ]
}
```

`part` is a node from the `forest` kit. `weight` is how often it comes up relative to its
siblings, `size` the range of its base scale, `sink` how far into the ground it settles as
a fraction of that scale. A boulder half-buried reads as bedrock; a tree buried the same
amount reads as a mistake, so the two want very different numbers. `upright: true` keeps it
standing; anything else may lie however it landed.

`tint` has three forms, and the tint **multiplies** the atlas rather than replacing it:

- `true` takes the world's own `rock` colour, which is what turns the pack's neutral grey
  boulders into lunar dust or Martian rust.
- `"#rrggbb"` names one.
- `[r, g, b]` names one that may go **above 1.0** per channel. You need this to turn a pine
  into a maple, because the pack's foliage is painted green and green times any hex red is
  a dark olive.

## Buildings

`world.recipes` is a list of structures. One is picked per session from the session's own
id, so a session always gets the same building.

```json
"world": {
  "scale": 1.45,
  "deck": 1.0,
  "floor": { "kind": "soil" },
  "kits": { "base": "builtin:spacebase.glb" },
  "atlas": { "source": "kit", "kit": "base", "cols": 8, "rows": 4 },
  "cells": { "TRIM": 11 },
  "accentCells": ["TRIM"],
  "surfaces": { "TRIM": [0.42, 0.08] },
  "recipes": [
    { "id": "hut", "label": "Hut", "steps": [ ... ] }
  ]
}
```

### The floor they stand on

A zone is a hex plate, and `world.floor` says what it is made of. Two floors are drawn, and
both tile, so a seven-cell zone reads as one continuous yard rather than seven repeats of a
medallion:

| `kind` | What it draws |
| --- | --- |
| `plate` (default) | Bolted metal panels: a 2x2 panel grid, cut seams, bolt heads, scuffs. |
| `soil` | Beaten earth: broad patches, grain in the direction things have been dragged, pebbles and clods with real relief. No straight line anywhere. |

Either takes colours of its own (`base`, plus `panel` `seam` `bolt` for plate and
`grain` `pebble` `patch` `grit` for soil) and four numbers the material reads off it:

`panel` is the face of the tiles or plates and `base` is only what shows in the gutters
between them, which is the pair to get right for a floor that is not grey. (`panel` was
documented from the start and not actually read until 5.16, so a theme asking for a warm
floor got a grey one with warm grout. It takes `#rgb` or `#rrggbb`; the shade is jittered
per panel, so unlike `seam` and `bolt` it cannot be an `rgba(...)` or a named colour.)

| Key | Meaning |
| --- | --- |
| `tint` | `0`..`1`. How much of the **zone accent** multiplies through. |
| `roughness` | `0`..`1`. |
| `metalness` | `0`..`1`. |
| `relief` | `0`..`2`. Normal-map strength. |

`tint` is the one to think about. The plate floor is authored neutral grey precisely so the
zone accent can own its colour completely, and that is `tint: 1`. Do the same to a beige
floor and a zone whose repo name hashes to teal gets teal dirt, so `soil` defaults to
`0.26`: the earth still reads as earth, with the zone's cast over it. A floor is cached per
spec, so switching themes redraws rather than reusing the last one.

### Buildings have to fit their zone

A recipe is scaled once by `world.scale`, and then **scaled again if it does not fit the
slot it was dealt**. A plot is a hex lattice cell (or several) and a building sits on one of
seven slots per cell: the middle one has most of the inradius to play with, the six on the
ring have about 1.8 units before the zone's border. Anything bigger is scaled down
uniformly to fit, so a large recipe becomes a large central building and a modest
outbuilding on the ring.

Which means: **author to the middle slot and expect the ring to shrink it.** If a recipe
only reads at full size, keep its footprint under about 1.8 and it will never be touched.
The number comes from `Plot.slotClearance`, which measures to the plot's OUTLINE, so a
multi-cell zone gives its inner slots more room than a single-cell one.

### Where colour comes from

Every building is one merged geometry with one material, and its colour comes from an
**atlas**: a grid of flat swatches that every surface points into. A *cell index* is
therefore a stable name for a colour.

Two ways to get one:

```jsonc
// The atlas packed inside a glb kit. This is what the built-in theme uses.
"atlas": { "source": "kit", "kit": "base", "cols": 8, "rows": 4 }

// Drawn from a list. NO ART REQUIRED -- this is what Samurai Village uses.
"atlas": { "source": "colors", "cols": 8, "rows": 4, "colors": ["#000", "#efe9dc", ...] }
```

`colors` is indexed from the **bottom-left**, left to right, bottom to top.

`cells` gives those indices names so a recipe can say `"cell": "TIMBER"` instead of `2`.
`accentCells` lists the swatches that get repainted with the zone's accent and light up
after dark. `surfaces` sets `[roughness, metalness]` per cell; keep metalness low on
anything painted, because a fully metallic surface has no diffuse term and turns black
with only a soft sky to reflect.

### Kits

`world.kits` maps a name to a glb. `builtin:spacebase.glb` and `builtin:forest.glb` are
the two the app ships; anything else is a file in your theme folder.

The kit list is **replaced**, not merged. A theme naming only its own kit gets only that,
rather than silently inheriting a space station it never asked for.

A theme with `"kits": {}` is legal and builds entirely from primitives.

### Shapes

One vocabulary, shared by buildings, the arrival point and the crew's worn kit:

```jsonc
{ "box":    [w, h, d] }                     // a wall, a crate, a floor
{ "prism":  [w, h, d] }                     // a gabled roof, ridge along X
{ "cyl":    [rTop, rBottom, h, segments] }  // a post, a barrel; 4 segments is a pyramid
{ "shell":  [rTop, rBottom, h, segments] }  // an OPEN cylinder: a cape, a sleeve
{ "arc":    [rTop, rBottom, h, segments, start, sweep] }  // PART of one: a garment
                                           // panel. 0 is +Z, so a centred front
                                           // panel is start = -sweep / 2
{ "plate":  [w, d, thickness] }             // a deck, a paving slab, a pond
{ "sphere": [r, wSeg, hSeg] }
{ "cone":   [r, h, segments] }
{ "torus":  [r, tube, rSeg, tSeg, arc] }
{ "cap":    [r, phiSpread, thetaSpread, wSeg, hSeg] }  // a patch of a sphere's surface
{ "rbox":   [w, h, d, radius] }             // a rounded box
{ "lathe":  [[r, y], ...], "latheSeg": 32, "latheArc": [start, sweep] }
                                           // a turned PROFILE: a garment, a bowl, a
                                           // helmet. Arc optional, 0 is +Z as for `arc`
{ "tube":   [[x, y, z], ...], "tubeR": r, "taper": [f0, f1], "tubeSeg": [along, round] }
                                           // a tube along a smooth curve; `taper`
                                           // pulls it in toward the end: a horn, a whisker
{ "softbox": [w, h, d, blend, seg] }        // a box blended toward its ellipsoid:
                                           // 0 a box, 1 an ellipsoid. Cloth, a hand, a pad
{ "capsule": [r, length] }                  // a shaft with rounded ends: a handle, a pole
{ "parts":  [ { ...shape, "color": "#rrggbb", "tint": true }, ... ] }  // merged
```

`lathe`, `tube`, `softbox` and `capsule` arrived in 0.2.82, so a theme that uses them
does not load in an older app. A lathe's profile may be written in either direction; the
engine turns its faces outward. A `parts` group may nest another `parts` group, and each
keeps its own colours: a helmet built once and scaled as a whole is one nested group.

In a composite, each piece keeps its own `color`. A piece that also says `"tint": true`
takes the **wearer's** colour instead, wherever the part's own `tint` comes from, so one
mesh can have a black lacquered bowl with fittings that follow the session. `tint` also
takes a fraction, `0` to `1`, for a piece that only partly follows.

Two things this needs to work. The part must set `material.vertexColors` (a composite's
colours are baked into the geometry, and the mask rides along with them), and the part
itself must set a `tint` for the mask to reveal: without one there is nothing to take, and
the piece simply keeps its own colour.

Modifiers, applied in this **fixed order**: `rotate: [rx, ry, rz]`,
`stretch: [sx, sy, sz]`, `shift: [x, y, z]`, `base: true`. The order is fixed because
"turn it then stand it up" and "stand it up then turn it" differ, and you should not have
to know which one this does.

A shape is **centred** on the origin by default. Building and arrival-point steps stand it
on the ground for you, so `y` there means height above the pad; the crew's kit keeps it
centred, because a part hangs off a bone.

### Building steps

A step places one shape, or one named part from a kit.

```jsonc
{ "part": "basemodule_A" }                  // a named node from a kit
{ "part": ["a", "b", "c"] }                 // one of them, at random
{ "part": "windturbine_tall", "solo": true } // the node WITHOUT its children

{ "box": [w, h, d], "cell": "TRIM" }        // any shape, in an atlas colour

{ "ring":  <step>, "count": n, "radius": r, "jitter": 0..1, "startAngle": a }
{ "grid":  <step>, "cols": n, "rows": m, "dx": x, "dz": z }
{ "any":   [<step>, ...], "weights": [...] } // exactly one branch
{ "group": [<step>, ...] }                   // all of them, as one gate-able unit
```

`ring` jitters by default, which is right for crates and wrong for the four posts of a
watchtower. `"jitter": 0` places them exactly, and draws no random numbers at all.

**`ring` and `grid` DROP the container's own `x`/`y`/`z`.** They re-run the inner step with
a computed `x` and `z`, so a height has to be written INSIDE the inner step and the group
can never be moved off the recipe's centre line:

```jsonc
{ "grid": { "cyl": [...], "y": 1.56 }, "cols": 3, "rows": 1, "dx": 0.62 }   // right
{ "grid": { "cyl": [...] }, "cols": 3, "rows": 1, "dx": 0.62, "y": 1.56 }   // the row
                                                          // lands on the floor
```

Nothing warns. `ring` also overwrites the inner step's `ry` with its own tangent angle, so
a ring of plates always faces outward and a `"ry": "turn"` inside one does nothing. To put
a group somewhere other than the centre, write the steps out.

Every step also takes:

| Key | Meaning |
| --- | --- |
| `x` `y` `z` | Offset. |
| `s`, or `sx` `sy` `sz` | Scale. |
| `ry` | Yaw, in radians. |
| `cell` | Which atlas swatch. A name from `cells`, or an index. Primitives only. **Not** one of the value forms below: `cellIndex` reads a string or a number and anything else falls silently back to the default cell. Vary a colour with `any`. |
| `emissive` | `0`..`1`. Glows at night. |
| `spin` | Turns in the vertex shader, about this step's own position. |
| `chance` | `0`..`1`. Whether it appears at all. |
| `kit` | Which kit to take `part` from. Defaults to `base`. |

Any number can instead be written:

| Form | Draws |
| --- | --- |
| `"rand"` | 0..1 |
| `"turn"` | a random yaw, 0..2π |
| `"DECK"` | `world.deck` |
| `["range", lo, hi]` | a float |
| `["int", lo, hi]` | an integer, **inclusive** at both ends |
| `["pick", a, b, ...]` | one of them |

### A worked example, with no art at all

```json
{
  "id": "farmhouse",
  "label": "Farmhouse",
  "steps": [
    { "plate": [2.5, 2.0, 0.1], "cell": "EARTH" },
    { "box": [2.2, 0.9, 1.7], "cell": "TIMBER", "y": 0.1 },
    { "prism": [2.7, 1.0, 2.1], "cell": "THATCH", "y": 1.34 },
    { "box": [0.52, 0.2, 0.04], "cell": "TRIM", "z": 0.9, "y": 0.72 },
    { "cyl": [0.12, 0.12, 0.24, 8], "cell": "LANTERN", "emissive": 1, "chance": 0.6, "x": 1.5, "y": 0.9 },
    { "ring": { "box": [0.3, 0.28, 0.3], "cell": "BAMBOO" }, "count": ["int", 2, 3], "radius": 1.45 }
  ]
}
```

Scale: recipes are authored on a 2-unit module grid and scaled once by `world.scale`. An
astronaut is about 1.1 units tall before that, so a building you can see over is about 1
unit and a tower is three.

## The crew

The body is one mannequin. Everything worn over it is a list of parts, each one
InstancedMesh for the whole crew, hung off a bone at the frame the body is actually on so
a hat cannot drift off a head that is looking down.

### The body underneath

```json
"crew": {
  "body": { "color": "#4b443c", "roughness": 0.84, "metalness": 0.02, "tint": "none" }
}
```

`tint` says what the per-agent colour paints on the body itself: `suit` (the default: the
effort heat, which is what the Crew theme does), `trim` (the state colour), or `none`
(leave it your own colour and let the KIT carry the per-agent signal).

**Set `none` for anything wearing armour or robes.** However much you put over the
mannequin, arms and legs of moulded plastic in a bright effort colour read as a spacesuit,
and no amount of costume on top fixes it. Move the effort colour onto worn parts with
`"tint": "suit"` instead: something large and high, like a banner, plus something small and
central, like a sash, reads better at map distance than the body ever did.

```json
"crew": {
  "scale": 0.56,
  "parts": [
    {
      "id": "kabuto", "bone": "head", "tint": "suit", "at": [0, 0.6, 0],
      "shape": { "sphere": [0.46, 14, 10], "stretch": [1, 0.58, 1] },
      "material": { "roughness": 0.42, "metalness": 0.12 },
      "wear": [true, true, true]
    },
    {
      "id": "maedate", "bone": "head", "at": [0, 0.68, 0.05],
      "shape": { "cone": [0.075, 0.4, 4], "stretch": [1, 1, 0.26], "base": true },
      "material": { "roughness": 0.35, "metalness": 0.65, "color": "#c9a227" },
      "wear": [
        null,
        { "copies": [[0.17, 0, 0, -0.5, -0.15, 1.0], [-0.17, 0, 0, 0.5, -0.15, 1.0]] },
        { "copies": [[0.23, 0, 0, -0.62, -0.12, 1.4], [-0.23, 0, 0, 0.62, -0.12, 1.4]] }
      ]
    }
  ]
}
```

| Key | Meaning |
| --- | --- |
| `id` | Unique. Names the mesh. |
| `bone` | One of nine. See below. |
| `shape` | Anything from the shape vocabulary. Centred on `at`. |
| `material` | `visor`, `face`, `glow`, `{ glow: "#hex", intensity }`, or `{ roughness, metalness, env, double, vertexColors, color }`. |
| `tint` | `suit` (the effort colour), `trim` (the state colour), `eye`, `pulseEye`, `pulseTrim`, or omitted for the material's own colour. Applies to the whole part unless its composite masks pieces with `"tint": true`. |
| `at` / `rot` | Offset and rotation in the bone's frame. |
| `shadow` | `false` to stop it casting one. |
| `when` | `working` to wear it only while a thread is running, `resting` only while one is not. See below. |
| `flex` | Cloth motion. See below. |
| `wear` | One entry per tier. See below. |

Three materials are the engine's rather than yours, because each is a shader: **`visor`**
cuts its own rounded silhouette with an SDF, **`face`** samples the expression atlas as a
mask (this is the part that shows the state, and every theme wants one), and **`glow`** is
unlit and pushed past 1.0 so the bloom pass picks it out at night.

### Surfaces: finish, sheen, pattern, clearcoat (0.2.88)

A part's material object also takes what the part is MADE of:

| Key | What it does |
|---|---|
| `finish` | A relief family, bumped into the light: `plaster`, `timber`, `weave`, `tile`, `thatch`, `stone`, `metal`, `lacquer`, `drill`, `brushed`, `hammered`. Projected from the part's own frame, so it moves with it. `finishScale` (repeats per unit) and `finishStrength` override the family's look. |
| `sheen` | 0 to 1: cloth's soft rim light. With `sheenColor`. |
| `clearcoat` | 0 to 1: a lacquer coat over the paint, with `clearcoatRoughness`. |
| `pattern` | A colour pattern: `houndstooth`, `check`, `stripe`, in `patternColor` over the part's own colour, `patternScale` repeats per unit. |

`crew.body` takes `finish` and `pattern` too, for a theme that shows the mannequin (the
kitchen's thighs are its trousers). Buildings get a finish per atlas cell without asking:
each cell's family is read off its NAME (`THATCH`, `TIMBER_DARK`, `PLASTER`...), and
`world.finishes` overrides it (`{ "CELL": "stone" }`, or `null` for flat). Building boxes
are chamferred; `"bevel": false` on a step keeps one sharp. An older app ignores every key in
this section, so using them does not raise a theme's minimum version.

`glow` takes its colour from the part's `tint` (the session's effort, trim or eye). When a
glow belongs to the CHARACTER instead -- a lightsabre's blade, which is blue for Rey,
green for Qui-Gon and red for Vader whatever the session is doing -- write
`{ "glow": "#3f9bff" }` and leave `tint` off. It is unlit like the other and multiplied by
`intensity` (default 1.6), which keeps it above 1.0 for the bloom. Needs 0.2.85.

**A `glow` part is ONE COLOUR, and nothing warns you.** `_partMaterial` returns a flat
`MeshBasicMaterial` with no `vertexColors` -- deliberately, because the whole point of a
glow is to be unlit. A composite carries its per-piece colours in a vertex-colour
attribute, so on a glow part they are read by nothing: every piece comes out the instance
colour, and the hexes you wrote are dead text. A `"tint": true` mask on its pieces is
baked and never sampled either. A lightsabre found this the hard way -- hilt and blade
were one glowing part, and the machined steel and the black grip both rendered as a bar
of pure crystal colour, a sabre with no handle. **Anything that glows and has detail in
it is two parts** sharing an `at`, a `rot` and a `wear`: the lit piece on `glow`, the rest
on an ordinary `vertexColors` material.

### Bones

| Bone | Where it is, and what hangs off it |
| --- | --- |
| `head` | The neck, at y 1.228. Local axes are the character's. Helmets, masks, crests. |

| `chest` | y 0.959, axes the character's. A cuirass, shoulder guards, a back banner. |
| `hips` | y 0.392, axes the character's. A hanging skirt, a belt, a sword. |
| `hand.r` | The working hand. Also spelled `hand`, which is what the astronaut kit uses. |
| `hand.l` | The off hand. A polearm, a lantern, a baton. |
| `upperarm.l` / `upperarm.r` | Local +Y runs down the arm. Sleeves. |
| `lowerleg.l` / `lowerleg.r` | Local +Y runs down the shin; the FRONT of the shin is local **-Z**. Shin guards. |

Three things about this table will cost you an hour each if you skip them.

**Offsets are in the BONE's frame, and only three of these bones have the character's own
axes.** An arm bone's +Y runs down the arm and its +Z is neither up nor forward, so a plate
you place at `[0, 0, 0.1]` on a shin is not in front of the shin. Build limb armour as bands
*around* the limb (a short cylinder), which is right whichever way the local Z points.

**The mannequin is thicker than it looks.** Its torso is about 0.72 wide and 0.53 deep, its
arms are radius 0.10 and its legs radius 0.095. Armour has to be sized to ENCLOSE that, not
to sit at it: a cuirass 0.50 wide on a torso 0.72 wide is invisible except for whatever trim
happens to poke out of the sides, and it looks exactly like a cuirass you got the colour
wrong on.

**A limb bone's local Y is not exactly the limb's own line** (about 20 degrees out on the
upper arm), so a long sleeve's far end walks off the arm. Keep limb pieces short.

The mannequin's own head mesh is **dropped**, so a kit with no head part leaves a headless
body. The body geometry stops at the neck (y 1.244) and your head part is the whole head.

**Leave the face alone.** The `face` part is a sphere patch 1.78 rad wide and 1.02 tall on
the head, which works out to head-local **y 0.215 to 0.625, x ±0.33** on a 0.42 head: the
whole middle half of the head's front. It is also the only thing on the figure that says
what a session is doing. A helmet therefore has to be a **cap that starts above 0.63**, which
happens to be how a real kabuto sits anyway. The samurai's first pass put a helmet band at
0.31 and a brow visor at 0.36, straight across the middle, and a general's expression was a
pair of eyes over a gold bar.

**A hand's local +Y points at the floor**, so anything held needs `rot: [_, _, PI]` to come
up. Watch the sign of the other axes when you tilt it: on both hands a POSITIVE `rot[0]`
tips a raised blade across the body, where the shoulder guard and the arm hide it, and a
negative one splays it outward where you can see it.

### Sharing a hand

`when` has two values and they are opposites: `working` is worn only while a thread is
running, `resting` only while one is not. That pair is what lets **two things occupy one
hand**. The village's sword hand carries a katana at rest and an adze while working, and
they can never both be there.

It is worth using for the read as much as for the geometry: a figure that has put its sword
away to pick up a tool is a figure you can see is working, which is the thing the map exists
to show.

A part with either flag is never counted as one-per-agent, so it gets its own instance
counter. That is not an optimisation you need to think about, but it is why a `when` part
costs a little more than a plain one.

### Cloth that moves

A cape, a surcoat, a banner, a hanging skirt plate: add `flex` and it stops being welded to
the bone it hangs on.

```json
{
  "id": "sashimono", "bone": "chest", "tint": "suit",
  "at": [0, 1.34, -0.79], "rot": [-0.28, 0, 0],
  "shape": { "box": [0.6, 0.74, 0.018] },
  "material": { "roughness": 0.9, "double": true },
  "flex": { "from": "top", "sway": 0.055, "rate": 2.6, "wave": 3.2,
            "lean": 0.26, "curl": 0.05, "turn": 0.22, "bias": 1.7 },
  "wear": [{ "scale": 0.74 }, true, { "scale": 1.28 }]
}
```

| Key | Default | Meaning |
| --- | --- | --- |
| `from` | `top` | The pinned edge: `top`, `bottom`, `left`, `right`, `front`, `back`. Everything moves relative to it, so the hem swings and the collar does not. |
| `dir` | `[0, 0, -1]` | Which way the cloth trails. The character faces +Z, so cloth left behind by somebody walking forwards goes to -Z. |
| `side` | `[1, 0, 0]` | The secondary ripple's axis. |
| `sway` | `0.03` | The idle breathing wave, in the part's own units. Cloth is never still. |
| `rate` | `2.2` | How fast that wave runs. |
| `wave` | `2` | How much the phase advances from the pinned edge to the free one. Higher is a travelling ripple; 0 moves the whole piece as a board. |
| `lean` | `0.12` | How far it trails per unit of walking speed. This is the one that reads. |
| `curl` | `0` | Sideways ripple amplitude. |
| `turn` | `0` | How far it is thrown sideways per unit of turn rate. A celebrating agent spins on the spot, which is a turn with no speed behind it. |
| `bias` | `1.6` | 1 tapers straight from the pinned edge; higher keeps the top still and whips the hem. |

`flex: {}` is a valid "flex, with the defaults". Zero every amplitude and the flex is
skipped entirely, which is how you turn one off without deleting it.

Two things to know. The displacement is in the part's LOCAL space, so for anything placed
with a yaw -- a ring of skirt plates, say -- `dir` points wherever that part's own -Z ended
up pointing, which for an outward-facing plate is *into the body*. Swing those along `side`
instead and leave `dir` alone. And a part worn several times gets a phase offset per copy,
so one wearer's seven skirt plates do not swing as a single board.

It is not a cloth simulation and it does not collide with anything. It is a vertex
displacement with three terms, and at the size a crew is watched from that is
indistinguishable from a solver.

### Tiers

`wear` has one entry per model rank: 0 is everything else, 1 is Opus, 2 is Fable. Tier 1
is the one you will see most, so it is the shape the eye calibrates on; tier 0 should read
as conspicuously stripped down from it and tier 2 as unmistakably loaded above it.

| Entry | Means |
| --- | --- |
| `null` | Not worn by that rank. |
| `true` | One, at the part's own `at` and `rot`. |
| `{ "scale": s }` | One, scaled. |
| `{ "mirror": true, "scale": s }` | One on each side. The x offset scales with it, and any z rotation flips, so a pair leans outward. |
| `{ "copies": [ ... ] }` | A set laid out by hand, offset from `at`. This is how two horns, a five-point crown and a skirt of seven plates each come off one shape. |

A copy takes either form:

| Copy | Means |
| --- | --- |
| `{ "at": [x, y, z], "rot": [rx, ry, rz], "scale": s }` | Added to the part's own `at` and `rot`. All three rotation axes. |
| `[x, y, z, rotZ, rotX, scale]` | The original form. Note the order, and note that it has **no yaw** -- so anything arranged AROUND the body needs the object form, or every plate in a ring faces the same way. |

Every copy of a part is one instance of the same geometry, so a part worn seven times needs
`capacity * 7` instances: keep the count sane. A tint applies to all of them.

## The arrival point

Where the crew walk in from. Set `ship.recipe` and you get yours instead of the lander:

```json
"ship": {
  "surfaces": { "hull": "#e8e0cc", "trim": "#b7472a", "engine": "#3c4048" },
  "lights": { "beacon": [3.0, 1.5, 0.5], "glass": [1.2, 0.85, 0.4] },
  "door": [0, 0, 5.6],
  "recipe": { "steps": [
    { "plate": [11.0, 8.0, 0.3], "paint": "tread", "z": 1.4 },
    { "cyl": [0.34, 0.42, 5.0, 12], "paint": "trim", "x": -2.3 },
    { "cyl": [0.34, 0.42, 5.0, 12], "paint": "trim", "x": 2.3 },
    { "prism": [7.2, 1.0, 2.6], "paint": "engine", "y": 4.7 },
    { "cyl": [0.3, 0.3, 0.5, 8], "paint": "glass", "lit": "glass", "x": -1.5, "y": 2.45 }
  ] }
}
```

A step is a shape plus `paint` (a key from `surfaces`), `x`/`y`/`z`/`ry`/`s`, and
optionally `lit`. Anything without `lit` merges into one hull, so a gatehouse of twenty
pieces is still one draw call. Anything with `lit` joins a group whose colour is rewritten
every frame from that light's tone:

| `lit` | Behaves as |
| --- | --- |
| `beacon` | A double-blink, like an aircraft strobe. |
| `pad` | Brightens at night. |
| `glass` | Brightens at night. Lanterns, windows. |
| `rampStrip` | Brightens at night, and again while anyone is walking in. |

Every group is optional. A lantern-lit gate needs no landing pad.

## When something is wrong

Nothing here throws. A theme is a file somebody typed, so being wrong is a normal state:

- A theme that fails validation is **refused whole**, and the others still load. Half a
  theme on screen is harder to diagnose than none.
- A misspelled part name costs you that one piece and a console warning.
- A kit that will not load costs you the buildings that need it.
- A cell name that does not exist falls back to the first accent cell.
- A stored theme that has since been deleted falls back to the built-in on next launch.

Problems are counted in a toast when the Crew view opens and listed in full in the
developer console.

## Two traps worth knowing

**Everything merged into one building must agree about being indexed.** All the
primitives here do. If you add a new primitive kind, give it an index even if it does not
need one, or `mergeGeometries` returns null and the building silently does not exist.

**Building shape is seeded from the session id, and the order values are drawn in is part
of that.** A step draws in this order: `chance`, then the branch or part choice, then
placement. Reordering the steps in a recipe reshuffles which building each session gets.

## Reference

- Built-in theme, and the schema it defines: `src/renderer/crew/engine/core/theme.js`
- The shape vocabulary: `src/renderer/crew/engine/core/shapes.js`
- The building step evaluator: `src/renderer/crew/engine/world/recipes.js`
- The worn kit: `src/renderer/crew/engine/agents/astronauts.js`
- Cloth motion: `src/renderer/crew/engine/core/flex.js`
- The attach bones, and what they cost: `src/renderer/crew/engine/agents/crew.js`
- The arrival point: `src/renderer/crew/engine/world/ship.js`
- The DEFAULT theme, generated, and the reference for a complete one:
  `tools/crew-sheet/examples/build-harbour-signals.py` (the world) plus
  `tools/crew-sheet/examples/harbour_kit.py` (the crew) ->
  `src/renderer/public/crew/themes/crew.json`. The kit is a separate module because it
  is where an external review's hard constraints are enforced, and each of them is an
  `assert` with the failure it prevents written next to it.
- A full second theme -- its own worlds, buildings, crew and gate, built entirely from
  primitives and one shipped kit: `src/renderer/public/crew/themes/samurai-village.json`
- A third, generated rather than hand-written, whose every offset is computed from the
  measured rig and asserted before it is emitted:
  `tools/crew-sheet/examples/build-galley-kitchen.py` ->
  `src/renderer/public/crew/themes/galley-kitchen.json`
