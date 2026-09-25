# Measured

The numbers a theme is authored against: the rig a crew kit hangs on, and the ground its
buildings stand on. Probed off the shipped assets and the live engine by
`tools/crew-sheet/bones.js` and `/probe.html` -- re-run those if the assets change, and
otherwise read these rather than guessing them.

**Both halves of this file exist because somebody guessed.** The first armoured pass guessed
the body and half the armour came out inside it, where only its gold trim showed. The first
building pass guessed the ground and the big recipes hung over the edge of their zone. Both
looked exactly like colour mistakes rather than geometry mistakes, which is why neither was
caught by looking.

# Part one: the rig

## Coordinates

The character is **2.2 units tall** (2.07 to the top of the kit's own head), faces **+Z**,
and its own **LEFT is +X** -- which is the hip a katana is worn on. The whole figure is
scaled once at draw time by `crew.scale` (0.56 for both shipped themes), so every number
here is in the *unscaled* character's units and a kit never needs re-tuning when that moves.

## Attach bones

Fifteen, from `ATTACH` in `agents/crew.js`. The list only ever GROWS AT THE END, because a
slot index is a row of the baked table and every shipped kit is authored against it. Rest
positions and local axes at the idle clip's first frame (`FIG.dumpRig()` on `/figure.html`
writes them to `out/rig.json`; re-run it if the rig changes):

| Bone | Origin | Local axes | Notes |
| --- | --- | --- | --- |
| `head` | `0, 1.228, 0.003` | ≈ identity | The NECK, not the head. Your head part is the whole head. |
| `chest` | `0, 0.959, 0` | ≈ identity | The shoulder pivots are chest-local `(±0.212, 0.134, 0)`. |
| `hand.r` | `-0.480, 0.632, 0.066` | x `0.263, 0, -0.965`  y `0, -1, 0`  z `-0.965, 0, -0.263` | +Y runs down the FINGERS, +X out of the little-finger side |
| `hips` | `0, 0.392, 0` | ≈ identity | The hip pivots are hips-local `(±0.171, 0.114, 0)`. |
| `hand.l` | `0.481, 0.634, 0.072` | x `0.263, 0, 0.965`  y `0, -1, 0`  z `0.965, 0, -0.263` | mirrors `hand.r` |
| `upperarm.l` | `0.211, 1.093, -0.017` | y `0.610, -0.758, -0.228` | +Y runs along the arm; the elbow is at local `(0, 0.242, 0)` |
| `upperarm.r` | `-0.211, 1.093, 0.020` | y `-0.633, -0.712, -0.305` | same |
| `lowerleg.l` | `0.197, 0.283, 0.022` | y `0.135, -0.923, -0.359`  z `-0.004, 0.362, -0.932` | the KNEE pivot. +Y down the shin, the ankle at local `(0, 0.149, 0)`; the FRONT of the shin is local **-Z** |
| `lowerleg.r` | `-0.182, 0.281, 0.042` | y `-0.058, -0.905, -0.420` | same |
| `foot.l` | `0.217, 0.145, -0.031` | y `0.113, -0.720, 0.685` | the ANKLE pivot. +Y runs forward and down along the foot (added 0.2.73) |
| `foot.r` | `-0.191, 0.145, -0.021` | y `-0.140, -0.720, 0.679` | same |
| `toes.l` | `0.236, 0.026, 0.082` | y `0.163, 0, 0.987`  z `0, 1, 0` | the toe hinge, lying flat; +Z is UP (added 0.2.73) |
| `toes.r` | `-0.214, 0.026, 0.092` | y `-0.202, 0, 0.979`  z `0, 1, 0` | same |
| `lowerarm.l` | `0.359, 0.910, -0.072` | y `0.360, -0.823, 0.440` | the ELBOW pivot; +Y down the forearm, the wrist at local `(0, 0.26, 0)` (added 0.2.75) |
| `lowerarm.r` | `-0.364, 0.921, -0.054` | y `-0.339, -0.865, 0.371` | same |

Things that follow:

- **`at` and `rot` are in the BONE's frame**, and only head, chest and hips have the
  character's own axes. A plate at `[0, 0, 0.1]` on a shin is not in front of the shin.
- **A bone's origin is its joint's pivot.** A sphere centred there looks the same at every
  angle the joint takes, which is how a seam between two bones is hidden: ankle (`foot`
  origin), knee (`lowerleg` origin), elbow (`lowerarm` origin), shoulder (on `chest`, above),
  hip (on `hips`, above).
- **THE FIST.** The closed hand of a kit that drops the arms is a glove sphere of radius
  0.105 at hand-local y **+0.03**; the mannequin's own mitten is bigger, radius 0.134
  centred at y **+0.083**. A held handle must contain the fist, and a head goes at the far
  END of the handle, never at the grip.
- **HOW A TOOL IS HELD: `rot: [-PI/2, 0, PI/2]`, `at: [0, 0.03, 0]`.** Build the prop with
  its handle along +Y from the grip and its head across the far end (the head's axis along
  prop Z). That rotation sends the handle out of the thumb side, in front of the figure,
  and the head's faces down into the work. The old `rot: [0, 0, PI]` stood every handle
  back up the FOREARM, so the head rose beside the face and the swing led with the butt.
  `lint_crew` (in `examples/build-galley-kitchen.py`) and `crew-kit-geometry.test.ts` check
  the grip in 3D with the part's full rotation.

Each bone costs about **47 KB** of baked side-table over the whole animation set.

## The body, measured

From the mannequin's own vertices, per dominant bone (`tools/crew-sheet/measure-feet.mjs`
for the feet; the arm slices were taken the same way). **The bind pose is a T**: the arms
run out along X at shoulder height, so a height band there reports the wingspan.

| Region | Size |
| --- | --- |
| Torso | y 0.45 to 1.24, about **0.72 wide, 0.53 deep**, centred z **+0.01**; widest (0.73) at y 0.73 to 0.83 |
| Belly and hips | at y 0.575: 0.69 wide, 0.51 deep. The belly is RIBBED (bellows), which a theme that keeps the torso can show on purpose |
| Upper arm, forearm | radius **0.105**, round; the upper arm hangs close enough that a torso shell swallows most of it at rest |
| Wrist | radius 0.08 |
| Mitten | radius **0.134**, hand-local y -0.03 to 0.20, centred 0.083 |
| Thigh | radius 0.105 |
| Shin | radius about 0.11; the whole shin is only 0.149 from knee to ankle, and carries a moon-boot upper with a hex bolt |
| Foot + toes | in the foot's own flat frame (forward along the toe bone, laid level, origin on the ground under the ankle): **±0.12 across, 0 to 0.151 high, -0.104 to 0.282 heel to toe**; a moon boot with a treaded sole at y 0 |
| Body geometry overall | y 0 to **1.244**: it stops at the neck |

The mannequin's own head mesh is **dropped** (`DROP_MESHES`), so a kit with no head part
leaves a headless body. The shipped themes use a sphere of radius 0.42 centred at
head-local y 0.42 (world y 1.648).

`crew.body.drop` can also delete `arms`, `legs` and `torso`. **Dropping the torso leaves
the thigh meshes with open tops** (a jagged crown at the crotch), which a seat on `hips`
has to close.

## How far each joint moves

Measured over the baked clips, against the idle frame. These decide whether a seam between
two bones needs hiding, and how:

| | walk | run | work | hit | cheer | jump / sit |
| --- | --- | --- | --- | --- | --- | --- |
| chest against hips | 0.6° | 4.5° | **30°** | **30°** | 14° | 19° / 14° |
| ankle | **45°** | 37° | 22° | 17° | 29° | **62° / 61°** |
| toes against foot | 5° | 8° | 0° | 0° | 0° | 1° (27° in the wave) |

The chest pitches about a point HIGH in the chest (world y 0.83 to 0.95), so anything hung
off `chest` below it swings out when a figure bends over its work: a coat's hem travelled
0.25. Cut a garment at the waist (upper on `chest`, lower on `hips`, something on the hips
over the seam), or let a skinned mannequin belly do the bending.

A walking leg's surface reaches this far from the body's axis at each height, which is why
no closed skirt below the knee survives a walk:

    world y   0.05   0.10   0.20   0.30   0.35   0.40   0.45   0.50
    reach     0.725  0.710  0.674  0.477  0.431  0.409  0.380  0.278

## The face is a no-go zone

The `face` part is a sphere patch 1.78 rad wide and 1.02 rad tall, centred on the equator
and on +Z. On a 0.42 head that is:

```
head-local   y 0.215 .. 0.625      x  -0.33 .. +0.33      at radius ~0.428, z > 0
```

The whole middle half of the head's front, and the only thing on the figure that says what a
session is doing. **Nothing may cross it.** A helmet therefore has to be a cap starting
above 0.63; there is 0.215 of head above the face to sit on, and a squashed sphere centred
around y 0.76 stays inside the 0.42 head sphere below ~0.615 and emerges above it, which is
exactly the right read.

## Clips

All fifteen are baked at 30 fps and laid end to end in one table (`CLIP` in
`agents/crew.js`), so all fifteen keys exist on `rig.clips`. `_animate` selects these:

| Key | Clip | Loops | Selected by `_animate` |
| --- | --- | --- | --- |
| `idle` | Idle_A | yes | default, and `watching` when it pauses |
| `walk` | Walking_A | yes | ground speed over 0.12 |
| `run` | Running_A | yes | ground speed over 1.25x walk |
| `work` | Hammering | yes | status `working` |
| `wave` | Waving | yes | status `waiting` |
| `hit` | Hit_A | yes | status `blocked` |
| `cheer` | Cheering | yes | status `celebrating` |
| `sitDown` | Sit_Floor_Down | no | status `sleeping`, once |
| `sit` | Sit_Floor_Idle | yes | after `sitDown` finishes |
| `spawn` | Spawn_Ground | no | while spawning |
| `interact`, `idleAlt` | Interact, Idle_B | yes | by an interaction (`agents/interactions.js`) |
| `workAlt` | Working_A | yes | no |
| `jump` | Jump_Full_Short | no | no |
| `standUp` | Sit_Floor_StandUp | no | no |

**Locomotion wins over status** in `_animate`: an agent pottering across its plot walks, it
does not hammer while sliding. Held parts key off the ACTIVITY (`activityFor(status)`), not
the clip, so a working agent walking between spots keeps its tool.

## Rig bones the kit cannot reach

The skeleton also carries `root`, `spine`, `wrist.l/r` and `upperleg.l/r`. They are not in
`ATTACH`. The thigh is the one a theme might want; until then, a seat on `hips` with spheres
on the hip pivots covers the top of it.

# Part two: the ground

Buildings do not stand wherever the recipe says. A zone is a **hexagonal lattice cell**, or
several, and each cell offers seven building slots: one in the middle and six on a ring. A
recipe is scaled once by `world.scale` and then **scaled again if it does not fit the slot
it was dealt**, so a footprint is a request rather than a promise.

| | Value | Where |
| --- | --- | --- |
| Cell size, centre to **corner** | 7.6 | `CELL` |
| Tile, pulled in so neighbours do not z-fight | 7.539 | `TILE = CELL * 0.992` |
| Cell size, centre to **edge midpoint** | **6.529** | `INRADIUS = TILE * cos(30°)` |
| Ring slot radius | 4.373 | `TILE * 0.58` |
| Kept clear of the border rail | 0.35 | `EDGE_MARGIN` |
| **Clearance, centre slot** | **6.18** | `Plot.slotClearance(0)` |
| **Clearance, ring slot** | **1.81** | `Plot.slotClearance(1..6)` |
| Slots per cell | 7 | `SLOTS_PER_CELL` |
| Cells a zone can grow to | 9 | `MAX_CELLS` |
| Deck top, the height everything on a plot is measured from | 0.45 | `DECK_TOP` |
| The cell the arrival point owns, which nothing else may use | `q -2, r 1` | `SHIP_CELL` |

## Author to the middle slot and expect the ring to shrink it

The largest shipped recipes come out at a footprint of about **2.9**, which is comfortable
in the middle of a cell and **60% too big for the ring**. `createBuilding` scales those down
to fit, which reads perfectly well -- a large central structure with smaller outbuildings
around it is what a plot of this shape looks like anyway -- but it does mean:

- A recipe that only reads at full size needs a footprint **under about 1.8**.
- A recipe with fine detail at full size will lose it on ring slots. Check both.
- `world.scale` moves every recipe at once, so raising it to make one building read pushes
  more of them past the ring's limit.

## Inradius is not circumradius

A hexagon is `CELL` across at its corners and only `CELL * cos(30°)` across at its flats.
Anything sized against `CELL` therefore overhangs the six edges by more than a tenth of a
tile. That one substitution is the whole of the original bleed bug.

## Clearance is measured to the ZONE's outline

Not the cell's. A multi-cell zone tiles exactly and reads as one continuous area, so a
building may hang over an internal seam; only edges with no sibling cell behind them are
real boundaries. `Plot.slotClearance` and `Plot.clampInside` both work that way, which is
why an inner slot on a three-cell zone has more room than the same slot on a lone one.

One implementation note worth keeping, because it is an easy thing to get wrong twice:
measure to each boundary edge as a **segment**, never as an infinite line. With lines, a
slot in one cell gets "constrained" by the far edges of a sibling cell it is nowhere near,
because it sits on the outside of those lines and the signed distance goes negative. The
first version did exactly that and reported a clearance of **-0.35** for a roomy slot.

## Things placed by hand

A building or an astronaut can be dragged (5.10). Placements are stored per thread in
plot-**local** coordinates, because a zone moves when the layout deals it a different cell
and a world-space placement would be left behind on bare terrain. A theme does not author
these, but two things follow from them:

- A dragged building is clamped by **its own footprint**, not by its slot's clearance, so it
  can legitimately sit closer to the border than the lattice would have put it.
- `Plot.clampInside` is the one function that decides what "inside the zone" means. If you
  add a lattice shape, that is what has to learn about it.
