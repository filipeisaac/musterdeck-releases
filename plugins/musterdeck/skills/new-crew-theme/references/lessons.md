# Lessons, by topic

Every entry here produced something that validated, loaded, threw nothing, and looked
wrong. `SKILL.md` states the rule; this file keeps the case that taught it, because the
case is what lets you recognise the fault in a different costume. Read the topic you are
working in before you start it, not after the render disappoints you.

Numbers here are in the unscaled character's units (2.2 tall, facing +Z, own left +X)
unless they say otherwise. Where a lesson names a file, the file is still there.

## How to look, measure and check

**A theme is read at about forty pixels tall.** Before adding detail, ask what it becomes
when it is four pixels wide. Silhouette, one or two colour blocks, and motion survive.
Everything else is for the artifact.

#### When you find a class of fault, sweep for the rest of it

A flat box authored at one z, laid on a round torso, protrudes in the middle and sinks at
both ends. That was found, written up at length, and fixed -- for the crossed front. The
TABARDS, one file away, were still boxes, and from the front each one read as a brown drip
running down the tunic and ending in a blob. The write-up is not the fix. Grep for the
shape of the fault (`softBox` positioned at a fixed `z` against a lathe) and fix every
instance in the same pass.

#### Build against a photograph

Four goes at the helmet from memory produced three faults that were all structural, and
all obvious the moment a reference arrived: it tapered IN where the real thing flares OUT
below the jaw, the brow did not overhang so the eyes could not sit in shadow, and the
mask was black when the nose, grille, mouth bar and chin are the one part that is NOT
black. No amount of tuning fixes a form that is wrong; ask for the reference early, and
when one arrives, list what it says before touching a number.

#### Pick colour against the RENDER, not the swatch

This scene lights a figure from four directions plus an environment and tone-maps with
ACES, so an authored hex lands on screen well over a stop lighter than it reads in a
palette. A "dark brown" robe authored at #5c432e came out mid-tan; darkened twice, to
#3e2c1c, it was still mid-tan. A rank whose whole job was to be the middle of a value
ladder was not, and no amount of choosing a better brown in the abstract would have found
that out.

Two consequences worth carrying: author the palette by screenshotting it, and know that a
scene lit like this one has a FLOOR -- it cannot show a genuinely dark diffuse colour, so
a value ladder has to be built inside the range the lighting actually gives you.

#### When a dark thing renders light, MEASURE it

`#0f1013` cannot make grey. So when a near-black shell reads as a grey helmet, the
question is not which hex to pick next; it is which term is adding the light. Swap the
part for a flat `MeshStandardMaterial` at roughness 1 with no coat, take the same
screenshot, and compare the same pixel: here it moved from #454649 to #373739 and the
whole form went from reading grey to reading black, which named the specular lobe in one
step after three rounds of guessing at colours.

The same lobe has now caused three different-looking bugs, which is why it is worth being
able to name: it blows out **one face** of a small flat facet (the grille recess), it
washes **a whole form** on a large curved one (the dome), and it is what a clearcoat with
no roughness turns into a **mirror**.

#### A kit is judged STANDING and worn MOVING

Every check these themes had judged a figure at the bind pose, which is the one pose it is
never seen in. The faults that live in the clips -- a thigh through a skirt, a fist through
a lapel -- are the first thing a reviewer sees and the last thing a still render shows.

`tools/crew-sheet/evolve/crewpose.py` poses the kit through every frame of all ten baked
clips without an engine: `out/viewer-data.json` already carries the attach bones' rest
matrices and every clip as flat 4x4s, so the arithmetic is available even though
`crewRig()` is null outside a browser. It measures two things, and it took three goes to
get the questions right:

- **ENTERS**: a limb goes from outside a CLOSED garment to inside it. The first version
  compared every part with every other and produced 873 findings, which is the same as
  none -- a sleeve is half inside a coat at every frame and always will be.
- **PIERCES**: a limb stands proud of an open PANEL at a height and angle the panel covers.
  Asked only of LEGS: a hand at the side, and whatever it is holding, is outside the coat
  by design.

The calibration that made it usable was running it on the OTHER themes first. Samurai
scored 2 and the kit under review scored 69, which turned "is this bad" into "why is this
twenty times worse", and the answer was structural rather than a tuning pass.

#### Check for crossing parts by SAMPLING, not by bounding boxes

A kit is spheres and cylinders and a box round a squashed sphere is mostly empty. The first
version of this check reported a cap band "entirely inside" its own crown -- the crown's
box reaches 0.470 in x, its SURFACE at the band's height is 0.381, and the band at 0.452
stands proud by 0.07 -- plus a tally inside a head and every piece of headwear crossing the
face. Nine of eleven were fine and the two that were not were lost in the noise.

`tools/crew-sheet/evolve/crewgeom.py` does it properly: each primitive becomes a solid with
a real `inside(point)`, and the question asked of a pair is what FRACTION of A's surface is
inside B. That is the right question, because a hat is supposed to be 60% inside the head
and a badge at 100% is a badge nobody will ever see. Two things fall out for free: `shell`
and `cap` are open surfaces and can never hide anything, which is why a cape over a coat has
never been a problem; and the same sampler answers the face question by projecting each
drawn point onto the skull and asking whether it lands on the patch, which is what finally
separated a brim standing off at radius 0.60 from a strap lying on a cheek.

#### A `wear` entry carries PLACEMENT, and a checker that forgets it is worse than none

The master's brass buttons are authored at `at: [0, 0, 0]` and placed by six `copies` at
z 0.322. A crossing check that read `at` put every one of them at the dead centre of his
chest and reported that they never render. They render fine. Anything that measures where
a part IS has to fold in the tier's `wear` offsets and scale first -- and note that a wear
`scale` multiplies the PLACEMENT as well as the shape, so `{scale: 0.8}` on a fitting at
z 0.345 quietly pulls it back to 0.276 and into the coat.

#### Tune the POSE before the tolerance

A sweep that reports a crossing has two fixes and only one of them is honest. When the
brigade's head tipped onto its chest and reported 0.10 of overlap, easing the pose from
0.205 to 0.15 came first -- moving the ruler before the thing it measures is how a check
stops meaning anything -- and it bought 0.007. THAT is the tell that the rest is the
instrument: a head is one sphere proxy 0.32 across and a torso lathe is a 0.79-tall
bounding box, so their proxies meet long before the geometry does. Then, and only then,
set the tolerance to the measured number and say in the comment that it is about the
probe rather than the kit.

Most tolerances are not that. Most are a decision about what two things are allowed to do:
a towel laid over a shoulder rests ON the arm, a knife roll on the hip is passed by the
forearm on THAT side, and two thighs 0.176 wide on hips 0.152 apart meet by 0.048 because
thighs do. Write the reason next to the number every time; a bare tolerance is a fault
somebody deleted.

#### A pair that cannot be separated is not a check

The sweep reported `robe/body` at 0.588 and the honest answer was neither a pose change
nor a tolerance: a coat contains a torso, so asking how far the two interpenetrate is a
question with no correct answer. Those pairs came OUT of `PAIRS`. A tolerance you invent
to silence a pair you could not have failed is worse than no check, because it looks like
a measured clearance to the next person reading the table. Check things that are supposed
to miss each other; delete the ones that are supposed to enclose.

#### An armature piece whose job is to overlap is not watched

`helm/body` fired 0.36 in every state and no pose moved it. The offender was the neck
flange -- the piece whose entire job is to sit down over the collar -- and the probe
turns a 0.05-thick ring into a chain of 0.23 spheres. The fix is neither a pose nor a
tolerance: **drop that PIECE from the watched zone and leave the zone watched**, so the
dome and the face plate still report, which is where a real collision would show. A
tolerance big enough to cover a ring swallowing a collar would hide a head going through
a chest. The same reasoning retires a pair (see above); this retires one mesh.

#### When a test breaks on a rebuild, re-point it by ROLE

Rebuilding the harbour kit broke nine tests, every one of them on `part('sleeve.l')` being
undefined while the thing it guarded was still true: the ranks had gone from sharing one
navy sleeve to wearing a rolled sailcloth one, an oilskin one and a reefer one. The fix is
a ROLE table at the top of the file -- three ids per role, one per rank -- and assertions
written against roles. The next rebuild then renames one list instead of nine tests.

That is a re-point, not a relaxation, and the difference is worth stating: a re-point keeps
the property and changes how it is addressed. Three of those nine were genuinely wrong
instead, and fixing them found real faults -- a `behind()` helper that ignored `stretch`, a
dome rule that only allowed emerging ABOVE the face (so a beard was reported as crossing a
band it is 0.28 clear of), and a bounding measure that returned twice the distance from the
origin. **A test that fails on correct work is a bug in the test, and it hides the two
failures that are not.**

#### A golden that guarded a migration is not a design decision

`crew-crew-kit.test.ts` pinned the astronaut's thirteen parts to the hundredth, because it
was written to guard the TRANSCRIPTION of hand-written placement code into data -- and for
that it was exactly right. Years later it was the reason the one unreviewed theme could not
be fixed without looking like a regression. When a golden blocks a deliberate, reviewed
change: keep the numbers that are still the numbers (the head, the visor, the aerial were
pinned exactly and still pass), and re-point the rest to the PROPERTIES the review decided
-- rank separation, where the effort colour may live, every rank holding something. Say in
the header why it changed, so the next reader does not restore it.

#### Run the theme's own gates before approval, not at ship

The Enclave's effort ramp had `low: #4FA3FF`, which is dE 9.2 from `--status-working`,
and a ramp that went backwards at step 3. Both are exactly what `crew-palette-clash`
exists to catch, and both sat there through an entire design review because the theme
lived in `themes/unshipped/` and the gate only walks `public/crew/themes/`. The art was
approved on top of a palette that could not ship.

Copy the descriptor into the shipped folder and run the suite EARLY -- the day the
palette is first chosen. A gate you run at the end is a gate that finds its faults after
somebody has approved them.

#### `crewpose` does not look at cloth; `clothcheck` does

`crewpose.py` skips every part that `flex`es, and those are exactly the parts a walking
leg goes through: skirts, robes, aprons, tails, capes. The brigade's apron and all three
coat skirts passed `crewpose` clean and put a knee through the cloth on every stride.
`evolve/clothcheck.py <descriptor>` samples the shins out of the baked clips in the hips
frame, moves each panel the way `flex` does while walking, and reports how far it comes
inside a leg. Judge it against HARBOUR, which was approved as it is: about 0.08 walking,
0.09 running, 0.05 standing. Its numbers are the bar, not zero.

What it taught, in numbers. The knee rises to world 0.46 in the walk and its top reaches
0.60, so no front panel below the belt clears it (a tabard's front tail, a jerkin's): cut
those at the belt. Side panels clear the legs when they are Harbour's cut -- 110 degrees
each, 70-degree vents fore and aft, the hem standing 0.47 out at 0.8 depth -- and not when
they are wider or hang straight (0.13). An apron that must be a front panel steps out to
0.40 just below the tie and LEADS with speed (`flex.dir` +Z): trailing it back, the
default, drives the hem into the knees.

And check the checker: its first run called Harbour clean because it only read `lathe`
panels and Harbour's are `arc`s. A tool that finds nothing on the approved theme has not
been calibrated; it has been skipped.

## Body, joints and fit

**Armour must ENCLOSE the body, not sit at it.** The mannequin's torso is 0.72 wide and
0.53 deep. A cuirass 0.50 wide on it is not a cuirass, it is a cuirass *inside* a torso:
only its trim pokes out and it reads as a colour mistake. Same for sleeves inside arms and
shin plates inside shins.

**Measure every worn part against the torso, which is 0.72 wide by 0.53 tall.** Write the
comparison down, because "it looks big" is not reviewable and a number is. The samurai's
banner was 0.60 x 0.74 scaled to 1.28 at the top rank -- 0.77 by 0.95, larger than the whole
body, on a pole 2.18 long against a figure about 1.6 tall -- and it passed two reviews because
nobody had put those two numbers next to each other.

#### A theme that KEEPS the mannequin fits to it; one that drops it rebuilds it

The two answers to a joint are opposite, and which one applies is decided by `body.drop`.
The harbour drops the torso and arms, so its kit IS the body and every joint needs a pivot
sphere. The colony keeps the mannequin, which is already a skinned spacesuit that bends
smoothly at every joint, and every rigid piece laid over a bending part fought it: a lower
shell against the belly, a band inside the arm, a glove 0.112 round on a mitten 0.134 round
(the mitten came through as a crack at the wrist). There the rule is: rigid pieces only
where the body does not bend, fitted to the MEASURED limb (upper arm and forearm 0.105,
mitten 0.134 centred 0.083 down the hand), the mannequin doing the bending between them,
and a shell's lip finished with a rolled rim so it reads as a closure rather than a cut.

Two more things the stills hid and `crewpose` did not:

- **The shoulder pivot is INSIDE the torso shell.** A band at a fixed distance along the
  upper arm sat in the shell at rest and stood off it as a fin when the arm rose. A sphere
  on the pivot (on `chest`) gives the arm one exit point at every angle -- it is also what
  an EMU's shoulder bearing is.
- **The upper arm hangs close enough that the torso barrel swallows it on every swing**
  (ten findings across walk, run and work for a band there). Anything that must be SEEN on
  an arm goes on the forearm. `lowerarm.l/r` are attach bones since 0.2.75 for exactly
  this.

#### A joint is a SPHERE ON THE PIVOT, and a garment is cut where the body bends

Every kit piece is rigid on one bone, and the body bends between bones, so wherever two
pieces on two bones meet there is a seam that opens when the joint moves. Two measurements
decide what to do about it, and `/figure.html` makes both cheap:

- **How far the joint actually moves, per clip.** Chest against hips is under 5 degrees
  in the walk and 30 in `work` and `hit`, about a point HIGH in the chest -- so a coat hung
  whole off `chest` swung its hem a quarter of a metre off the skirt on `hips` while
  working. Cut the garment where the body bends: upper half on `chest`, lower half on
  `hips` running up inside it, and something on the lower bone proud of both over the seam
  (the harbour's belt, the colony's waist bearing -- a real suit is built exactly so).
- **Where the pivot is.** A sphere centred on a joint's pivot is the same sphere at every
  angle, so pieces on both bones sinking into it never show a gap. Ankle (the `foot`
  bone's origin), knee (the `lowerleg` origin), hip (`upperleg`, hips-local
  (+-0.171, 0.114, 0)). The harbour's knees, seat and boots and the colony's knees and
  boots are all this one idea.

**THE FEET ARE ATTACH BONES since 0.2.72** (`foot.l/r`, `toes.l/r`, appended to
`ATTACH_BONES` so no shipped slot moved). A boot on `lowerleg` cannot work on this rig:
the ankle is 0.149 below the knee and the foot is a moon boot 0.24 by 0.39 that bends up
to 45 degrees in the walk. Use `evolve/boots.py` -- shaft on the shin, sphere on the
ankle pivot, vamp and sole on the foot, toe cap on the toes -- which sizes every piece off
the real foot (`measure-feet.mjs`) in the foot's own flat frame and converts it to each
bone's local `at`/`rot` with the rig's idle matrices. Sit the sole a few millimetres BELOW
the mannequin's, or its tread z-fights through.

**A DROPPED TORSO LEAVES THE LEGS WITH OPEN TOPS.** `drop: ['torso']` deletes the mesh
the thighs are closed by, and the cut edge shows as a jagged dark crown at the crotch
under any short garment or through a vent. A seat on `hips` -- a sphere on each hip pivot
and a block between -- closes it and moves with the thighs.

#### Judge the kit on the REAL body, not the harness proxy

The review's tab-1 viewer hangs the kit on a stick mannequin drawn between the attach
bones: right for inspecting one part, wrong for judging a belt, a boot or a knee, and it
has no feet to speak of. A reviewer screenshotted the proxy's feet and called them wrong,
and they were -- but so were the real ones, for a different reason, and only the real rig
showed that. Two surfaces now use the app's own `Astronauts` renderer on the real skinned
mannequin: `/figure.html?theme=<id>` in the harness (`FIG.strip({ clip, status, times,
yaw, zoom, focus })`, `FIG.tryParts([...])` to try a part live, `FIG.dumpRig()` to export
the bone table), and the "On the real body, moving" stage at the top of the review's
tab 1, which embeds `crew.glb`. Judge fit there.

#### No closed skirt below the knee survives a walk

Measured, on the common clips: a walking leg's surface reaches 0.72 from the body's axis
at world y 0.10 and 0.61 at 0.25, and only drops under 0.43 above y 0.43. So an
ankle-length coat that contained the legs would have to be 1.45 across, which is a bell.

Two ways out, and only one of them keeps the silhouette:

- END THE COAT AT WORLD 0.43 and carry the column with tall boots below it.
- BELOW THE KNEE, USE PANELS. A leg swings fore and aft, so the panels sit at the SIDES
  and the vents front and back -- which is a greatcoat worn open, and is the view the map's
  three-quarter camera shows anyway. It is also what the samurai's kusazuri are and why
  that theme scores 2.

**And hang them off `hips`, not `chest`.** This mattered more than the shape did: on the
chest a skirt swings with the ribcage, so in the work clip the torso bends over a hammer
while the legs stay planted and the coat's own panel arrives where a leg already is, 0.54
proud at the worst point. A skirt hangs from the pelvis on a real body and it has to here.

**A GARMENT ON A ROUND BODY IS A TURNED FORM.** Every panel -- coat, skirt, double breast,
apron, bib, collar, neckerchief -- is a lathe ARC. A flat box authored at one z meets a
torso whose front is at a different z at every x, so the curve cuts a wedge out of it and
only the corners emerge; `evolve/kits.py` exists to push those panels back out and it is
treating a symptom. An arc has the body's curvature by construction and never needs
tuning. Two traps: `LatheGeometry` puts phi 0 on **+Z**, not +X -- assuming +X centred
every wrapped garment on the LEFT HIP, and the apron came out as a small pouch beside the
figure -- and an arc needs `material.side = DoubleSide` or its inside is missing.

#### A single cylinder is not a turned form, it is a drum

"A garment on a round body is a lathe arc" is elsewhere in this file, and the first attempt
at it replaced three rounded boxes with three cylinders -- which came out as a head
balanced on a barrel. A constant radius from hip to neck has no SHOULDER, so the arms leave
the body at mid-height and the head sits on a flat 0.80 disc.

A torso is two pieces: a slightly tapered body from the hem to the chest, and a squashed
sphere above it whose own curve IS the shoulder slope and whose top narrows to about a
neck. The closing is the whole silhouette.

The vocabulary gained `arc: [rTop, rBottom, h, seg, start, sweep]` for this work -- part of
an open cylinder, which is what every garment panel on a round body actually is. Angles
follow `CylinderGeometry`: 0 is +Z, so a centred front panel is `start = -sweep / 2`.

**A FLAT PANEL ON A ROUND BODY MUST CLEAR ITS WIDEST POINT.** Every garment in every
theme is the same construction: a rounded body (a `cyl` or `shell` round the torso) with
flat `box` panels laid on its front -- lapels, apron panels, a button placket, a chest
grille. The panel is authored at ONE z and the body's front is at a different z at every x,
so unless the panel's BACK face clears the body's radius at the panel's innermost x, the
curve cuts a wedge out of it and only its corners emerge. On a torso of radius 0.4 the
front falls away 0.03 within 0.17 of the centre line, which is less than half a panel's
width.

It does not read as a small error. The kitchen's coats and the jedi tunics came out fringed
with white shards along every edge, and the baker's apron had a tie buried 0.098 deep
showing as two spikes: it reads as TORN, which is worse than a missing piece, because a
missing piece reads as simplicity. Seventeen panels across two themes were wrong.
`tests/unit/renderer/crew-garment-surface.test.ts` pins the arithmetic now. Scope it to
`chest` and `hips`: on a hat or a held prop a box is STRUCTURE, and the first version of
this fix moved the kitchen knife's blade 0.07 off its own handle.

**A RIB RING AT ONE RADIUS ON A TAPERED BAND** has the same fault in cylindrical form. The
kitchen toque's pleats were at radius 0.287 on a band running 0.275 at the hem to 0.305 at
the top, so each pleat stood 0.022 proud at the bottom, flush in the middle, and was
swallowed at the top: a row of white teeth round the hem of every chef's hat in the theme.
Clear the band's LARGEST radius, and remember that a 14-gon's flats sit a further 2.5%
inside its nominal radius, so clearing the nominal radius is not enough.

**AN ARM NEEDS AN ELBOW.** One tube from shoulder to hand reads as a pipe whatever the
pose does with it, and every motion becomes the whole arm swinging from the shoulder like
a gate. Upper arm, a ball in the socket so no seam shows however it swings, then a forearm
group. A pan toss is then wrist and forearm with the shoulder barely moving, which is the
difference between a cook and somebody shaking a pan.

**A SLEEVE STOPS AT THE ELBOW EVEN WHEN THE ARM IS DROPPED.** `assert_above_elbow` is
usually explained by the mannequin's forearm walking through worn cloth, so it looks
redundant once `body.drop` has deleted the arm. It is not: the sleeve still hangs off a
bone that does not bend, so past 0.246 it tears away from whatever dresses the forearm,
and now it leaves a HOLE rather than a bulge. Put a ball over the hinge, which is where a
figure with a real elbow ends up from either direction.

#### A dressed forearm hangs off `lowerarm` now; before 0.2.75 it had to use `hand`

Until 0.2.75 the only bone that followed a forearm was `hand`, so a theme that dropped the
arms (harbour, kitchen) hung its forearm there, solved against the hand-local direction
from wrist to elbow (`galley-kitchen` has the numbers). That works, but the hand turns at
the wrist, so the forearm piece swings with every wrist bend. `lowerarm.l/r` are attach
bones now: a new theme puts forearms, elbow balls and forearm bands there.

`references/measurements.md` used to say a limb bone's +Y is about 20 degrees off the
limb's line. Measured off the bind pose it is not: the elbow sits at upper-arm-local
(0, 0.242, 0) and the wrist at forearm-local (0, 0.26, 0). What misleads is the SHAPE --
the mannequin's arm carries small detail meshes that shift a slice's centroid -- so fit
limb pieces to measured radii (0.105 upper arm and forearm), not to centroids.

**A LIMB IS NOT A PROP.** `body.drop` means a theme can build its own arm, and a forearm
had to hang off the HAND bone, the only bone that followed it before `lowerarm` joined
the attach bones.
Two unit tests and the kit linter all read that arm as something the cook was carrying
badly and told the kit to move it up into the fist, because until then nothing on a hand
bone had ever been part of the body. Mark it, and check the mark in all three places.

**EVERY THEME NEEDS CLOTH THAT MOVES.** Harbour shipped with 33 parts and not one `flex`,
and it was the only theme whose four cloth plates came out **byte-identical** -- still,
walking, running and pivoting rendered the same image, because there was nothing on the
figure to move. Motion is one of the three things that survives at forty pixels, alongside
silhouette and one or two colour blocks, so a rigid figure throws away a third of what the
map can say. Hash the plates if you are not sure; identical files are the proof.

#### A rebuilt torso hides the upper arm: carry the sleeve past the elbow

With `drop: ['torso']` and a turned jacket at the samurai's scale, the rig's upper arm
(0.24 long) sits almost wholly INSIDE the jacket's shoulders. A sleeve that stops at the
elbow shows as a cap, and the whole visible arm is forearm: the brigade's "white to the
elbow" read as bare skin from the shoulder. Colour the arm pieces red, blue and green on
`/figure.html` to see which bone owns what, then carry the sleeve down the forearm over a
ball on the elbow's pivot. The same goes for a hair mass placed "behind the head": inside
the skull it lets the scalp show through from behind. Build hair as a shell just outside
the skull (a lathe arc at head radius plus 0.02).

## Heads, hats, hair and the face

**THE FACE IS THE STATE.** Build it by RAYCASTING the head from outside inwards -- a ray
started at the centre only ever meets back faces and a front-side raycast throws those
away, so a guessed fallback puts every feature about 0.10 proud of the skull and, seen
from the side, the mouth floats in mid-air.

**Do not cross the face.** The `face` part is a sphere patch covering head-local
y 0.215 to 0.625, x ±0.33 -- the whole middle half of the head's front -- and it is the
only thing on the figure that says what a session is doing. A helmet has to be a cap that
starts above 0.63, which is how a real one sits anyway. A band at 0.31 turns an expression
into a pair of eyes over a bar.

**Clearing the face is not the same as closing the gap above it.** A dome's radius falls
away faster than the head's does near the top of the face, so a helmet that provably does
not cross the patch can still leave a band of BARE HEAD between itself and the eyes -- and
it reads as a helmet sitting too high rather than as a missing piece, which is why looking
at it does not diagnose it. Vader shipped a strip of forehead that way, with an assert
next to it confirming the dome was legal. No amount of moving the dome closes the gap
without clipping the expression: it takes a separate band starting EXACTLY at `FACE_TOP`
and reaching at least as high as the dome becomes visible, and as wide as the head is
across its own height (a narrow band leaves the same strip at the temples instead).
Assert both ends of that band, not just the dome.

**There are FOUR ways to be legal beside the face, and a check that knows three of them
raises false alarms.** Above y 0.625; below y 0.215; outboard of x ±0.33; and **behind**,
because the patch is a cap on +Z only and nothing at the back of the skull can reach it at
any height or width. A hood's back bunch is on the head's axis and dips far below the
face, so a dome test that ignores z calls it a crossing piece. A false alarm costs a real
edit, so it is worth the extra clause.

**Measure at the INNER EDGE, and include `at` and `rotate`.** Three separate false passes
came from measuring the wrong thing: a 0.13-wide panel centred at 0.375 has its inner face
at 0.310, inside the patch, while the assert on its centre said 0.375 > 0.35 and passed;
the padawan braid measured as a thing at the centre of the head because the check read
`shift` and ignored the part's own `at` of 0.345; and a cylinder laid across the brow with
`rotate: [0, 0, PI/2]` measured 0.75 TALL, because a cylinder's length is its Y until
something turns it. Feed `at`, `shift` and `rotate` into every geometric assert, and swap
the axes when `|sin(rz)| > 0.7`.

**A HAT MAY NOT BE WIDER THAN THE HEAD IT SITS ON, MEASURED WHERE IT GRIPS** -- and it
grips at ITS OWN lowest edge, not at a height picked in advance. Measuring every hat
against one height failed a cloth cap for a fold sitting exactly where it should: a cap's
rim is 0.09 higher than a toque's band, where the skull is 0.04 wider. A hat also has to
be TALLER than the hair it covers, not only wider: squashed to 0.84 a cap crowned at 0.610
against hair topping out at 0.652, so the fringe came out through the top and it read as a
headband. Two checks
passed the kitchen's toque and it renders as a balloon on a stick with the pleats standing
off in daylight all the way round, because both asked about the AXIS and the gap is
ANNULAR: out at radius 0.30 the crown's underside curves up to 0.786 while the skull is
only 0.714. Chased to the source, the crown was r 0.42, and 0.42 is the skull's FULL
radius, which it only has at its equator -- below the face, where no hat may go. A crown
that wide can never close onto a head it sits on top of. The rank ladder was never carried
by width anyway; Escoffier's ladder is HEIGHT.

#### The seat check measures where the thing GRIPS

"A hat may not be wider than the head it sits on" is right, and the flare of a helmet, the
brim of a hat and the skirt of a coat are all wider than the head on purpose. What has to
fit is the band that holds the thing ON. Measuring Vader's bell at its widest failed a
helmet that fits perfectly. Register the gripping form in the seat check and leave out
everything hanging below the grip line.

**A BAND ROUND A DOME IS CONSTRAINED BY CURVES, NOT POINTS.** Three attempts, and the first
two made it worse. The rule has two halves, and the dome is only ever visible where BOTH
fail:

- Its rim must sit under the head's **facet minimum**, not near its surface. An n-gon dips
  `1 - cos(PI/n)` of its radius inside its own circle -- 0.0068 at eighteen sides -- so a
  rim placed 0.006 clear of the skull is *inside* it at every facet midpoint, and you see
  under it.
- Its cone must clear the dome everywhere the dome is not already hidden by the head. This
  is the one that took three goes: **a straight cone between two points on a convex dome
  lies INSIDE the dome between them**, so a band sized to touch at top and bottom is a few
  thousandths too narrow in the middle and the dark crown comes through as a ring of
  notches. It looks exactly like faceting, which is why raising the band to 32 sides did
  not help either.

And the two margins can be mutually impossible: with the dome only 0.006 inside the head at
the rim, there is no width left to be both outside the dome and inside the head. Tucking the
dome deeper is what buys the room. `tests/unit/renderer/crew-kit-geometry.test.ts` asserts
all of it along the band's whole height.

**AND IT MUST ENCLOSE AT THE BACK, WHICH IS EASY TO FORGET.** `vaderHelm` was a dome on
top, two side panels and a face plate, with nothing at all behind: the skull showed between
the helmet's lower edge and the shoulders at every angle that was not the front, on the top
rank of its theme. A head covering is authored while looking at the front, and the front is
the one view that cannot reveal this. The licence to work with is the one the face test
already encodes: a piece whose whole z-extent sits at or behind the head's centre plane
cannot reach the face patch whatever its size -- which is also exactly what a helmet's back
IS. Size the back piece to end at that plane, and make it WIDER than the skull at its own
depth or it is inside the head and invisible, which is how the first attempt failed and how
the suite caught it.

**ROTATE HAPPENS BEFORE STRETCH, and that ruined a hat.** `core/shapes.js` fixes the order
as rotate, then stretch, then shift -- so a `stretch` shrinks the axes the shape has
ALREADY been turned onto. Harbour's cap peak was `cyl` + `rotate: [PI/2, 0, 0]` +
`stretch: [1, 1, 0.36]`, meant as a flat visor and delivered as a near-black disc 0.56
across standing VERTICALLY inside the skull. The only part of it anybody ever saw was its
sixteen-sided rim emerging at the temples, as two black spikes and a ring of dark diamonds
where it crossed the cap band -- which reads as a shading bug, so three people looked at
the colours before anyone measured the geometry.

A cylinder's axis is already Y, so that rotate was never needed; without it the same three
numbers describe the peak that was wanted. A TORUS is the legitimate case -- rotating one
flat and then squashing it front-to-back is how both a collar and a hood are made -- so if
you stretch a rotated shape, be able to say why.

#### Hair is not a cap, and a hat is not a haircut

A sphere segment parked on the skull reads as a swimming cap on one figure and a rigid
bob on the next, and the cause is one thing: **a phi cut is a horizontal circle**. The
hairline comes out ruled straight across the brow, which no head has -- and at the
temples, where a spherified cube is wider than the sphere the cut was sized against, the
skull shows through as two bald patches either side of it. The seat check passed that
twice, for the reason the toque passed twice: **the check asks about the AXIS and the gap
is at the CORNERS.**

Hair is a mass that is generously bigger than the skull and never cut near the face, plus
the three things that actually make a hairline, each placed by the same raycast the face
uses so none of them can float or gap:

- a **fringe**, laid lock by lock, with a RAGGED bottom edge -- nine locks all the same
  length give a smooth arc, and a smooth arc across a brow is a headband;
- **sideburns**, small, which is what closes the temple corner -- at 0.15 deep they read
  as earmuffs;
- a mass at the **nape**, without which a head of hair is a cap painted on from the front.

And build a lock BOXY, not round. Nine spheres at 0.82 blend, however much they overlap,
are nine spheres: the fringe came out as a row of beads sitting on the forehead. At 0.52
each lock has flat faces that meet its neighbour's and the row reads as one edge.

#### Gathered hair gets no cut at all

The fringe rule assumes there IS a fringe. Hair that is pulled back has none, so the phi
cut has nothing hiding it and comes back as the rim of a helmet -- and the sideburns that
close a cut temple read, on a gathered head, as two scars on the cheeks. A gathered head
wears a WHOLE sphere, set high and back: what you see at the face is the sphere's own
silhouette, a curve that dips at the temples, which is exactly what a pulled-back
hairline is. No cut, no fringe, no sideburns.

#### A beard is seen flat on, so it has to be ONE form

The fringe rule -- wide, boxy, heavily overlapped locks merge into one edge -- is right,
and applying it to a beard produced a ring of grey BLOCKS round the face twice: a cog, or
a stone mask with two slots for eyes. The difference is the VIEWING ANGLE. A fringe is
seen edge on, so all that reads is its bottom line and the locks disappear into one
waver. A beard is seen flat, so every lock shows its own facet and its own highlight, and
nine in a row read as nine in a row. Same for anything else the viewer looks straight at:
a chest panel, a pauldron, a shield.

So a beard is one smooth mass (plus a darker underside and a moustache), and the
alternating tone that makes a fringe read as hair is exactly what makes a beard read as
masonry. One material.

#### If a feature lands inside something, move the FEATURE

A beard over the lower face swallows the mouth, and the mouth is what the face table
changes -- so a bearded rank silently loses every state it has. The fix is not to cut a
notch in the beard, which reads as two chops and a goatee. It is to draw the mouth ON the
beard, at the beard's own standoff, which is also where a real one is. That is the same
move as putting Vader's lenses on the mask profile rather than the skull, one rank along:
when a feature and a covering disagree, the covering wins and the feature relocates.

#### A mask stands off the skull, so its features have to be lifted onto it

Face features are placed by raycasting the head from outside inwards, which lands them on
the SKULL. A helmet, a visor, a respirator or a hood is a second shell a few millimetres
further out, so a feature placed correctly by that rule sits INSIDE it and is invisible --
which is exactly how Vader lost his lenses and his grille, on a figure whose entire read
depends on them. Lift each feature by the mask's own standoff (.058 to .064 here) and
look at it from the side, where a floating feature and a buried one are both obvious and
a front view shows neither.

#### A lens is not an eye

The idle face nudges the eyes sideways by 0.02, which reads as a glance on an eyeball
rolling in its socket. Applied to a lens bolted into a mask it slid the left one behind
its own rim: a red crescent on one side and a full lens on the other, so it read as a
defect on one eye rather than as a look. A part that the face table drives needs to say
which kind it is; here the flag is `fixed`, set for the masked rank.

#### A raised visor is a sphere patch, not a ring

Two goes at the commander's sun visor as turned forms -- a `cyl` plate, then a `shell` band --
both read as a halo, because the helmet is a sphere and a cylinder standing 0.03 off it at
the brow stands 0.09 off it at the crown. A `cap` at a radius just outside the visor's, tipped
up with `rotate` about X, follows the curve exactly. **Anything that lies ON a round head is a
cap; anything that goes AROUND one is a torus or a cylinder.**

## Hands and what they hold

**A HAND HOLDS ONE THING, AND WHAT IT HOLDS IS THE RANK.** Each brigade rank rests with
its own tool -- paring knife, chef's knife, tasting spoon -- and all three work with a
pan, so putting the tool down to pick the pan up IS the transition from waiting to
running. Two rules underneath that:

- **Build the tool ACROSS the grip point, not upward from it.** The group's origin is the
  fist, so a handle has to span it. Building each tool upward from an origin below the
  hand put the fist on the BUTT of the handle: a 0.03 error on a knife that nobody sees,
  and 0.36 on a pan, which hung a whole handle's length away and was the one that showed.
- **The HEAD goes at the far end of the handle, never at the grip.** The fist is a
  0.105-radius glove at hand-local y +0.03; a hammer head placed at the group origin sits
  inside it, and the figure reads as empty-handed however right the handle is. Harbour and
  the colony both shipped exactly that in 0.2.68: the tool was worn, the lint was clean and
  the review showed nothing. The samurai layout is the reference: grip at the fist, handle
  running out of it, head across the end (`hammer()` in `evolve/harbour_crew2.py`,
  `driver()` in `evolve/colony_crew.py`).
- **A hammer is held ACROSS the fist, not along the arm: `rot: [-PI/2, 0, PI/2]`.** The
  hand bone's +Y runs down the FINGERS and its +X out of the little-finger side, so every
  tool stood up with `rot z = PI` (the samurai's, and everything copied from it) ran its
  handle back up the FOREARM: the head rose beside the face and the swing led with the
  butt. It was reported as "the hammer is backwards", and it was, on three themes. The
  grip above turns the prop's +Y to the bone's -X (out of the thumb side, in front of the
  figure) and its Z to +Y, so a head built across the handle's end strikes DOWN. Found by
  hanging three coloured axis markers on the fist and posing the rig, which took one
  frame and settles any "which way is this bone" question. Check a whole `work` cycle
  side-on on `/figure.html`: raised, the head goes back over the shoulder; at the strike
  the handle is forward and the head vertical.
- **A tool that is not a shaft gets its own frame.** A pan is a dish with a handle out of
  one side; forcing it onto the hand's +Y ties the maths in knots. Build it bowl-axis up
  with the handle along +Z from the fist, and then the neutral grip is "a level pan held
  out in front", which is a pose rather than a number to tune.

**AIM WHAT IS HELD IN THE FIGURE'S FRAME.** A prop parented to a forearm inherits the
shoulder swing and the elbow bend, so raising an arm to cheer turns the pan upside down.
What a hand does with a tool is CARRY it. Let the state say where the tool points relative
to the BODY and cancel the two joints out of the group's own rotation:
`local = (arm * forearm)^-1 * wanted`. One line, and it covers the bow, the hop, the cut
and keeping a plate level while the arm reaches across a pass.

**AND THE CHECK FOR A HELD PROP STOPS AT THE HANDLE.** The grip rule is well written and
well tested: the handle must contain the fist. Nothing asks where the rest of the tool
ends up, so a correctly gripped knife at `rot[0]` -0.38 stood a blade's length out from
the figure and read as a blade floating beside a cook -- the exact words the grip rule
exists to prevent, reached from the other side.

**Two things can share one hand.** `when: "working"` and `when: "resting"` are opposites,
so a drawn sword and a work tool can live on the same bone and never coexist. It also says
something true: a figure that has put its sword away to pick up a tool is a figure you can
see is working.

**EVERY THEME MUST DECLARE A WORK TOOL, and it must not be a weapon.** The work clip is
`Hammering`, so whatever is in the hand while `activity === 'working'` is what gets swung at
the masonry. Two themes shipped this wrong in opposite directions: Harbour had nothing
gated on `working` at all and its crew hammered warehouses with bare fists, and the Jedi
enclave had its *lightsabre* on the working gate and built huts with a plasma blade, which
is what "the Jedis are not hammering with their lightsabers" was reporting.

It does not have to be a hammer -- the kitchen's is a pan, the harbour's a caulking mallet,
the village's an adze, the enclave's a hydrospanner -- but it has to exist, it has to be
worn by every rank (work is not a rank), and the ceremonial weapon belongs on `resting`.
`tests/unit/renderer/crew-work-site.test.ts` checks all of that for every theme.

**`when` keys off the ACTIVITY, not the clip.** It used to ask `clipKey === 'work'`, and
locomotion beats status in `_animate` -- so a working astronaut walking between spots on
its building's ring is on the WALK clip, and every `working` part vanished while every
`resting` one appeared. A samurai put its mallet away and drew its katana every five to
twelve seconds. The probe measures it: three of seven working agents are mid-walk at any
sample, and all three now keep their tool.

#### A carried tool is carried whenever the hand is free

A figure standing about with its weapon stowed reads as somebody who has put their tools
away. Ask of every state whether that hand is doing anything: if it is not, the tool goes
in it. Here idle and waiting both took the hilt, unlit, which is the whole difference
between carrying and drawing -- and waiting waves with the OTHER hand, so what is held
never crosses the gesture that is asking for attention. The stow point empties the moment
the hand fills, because one sabre is one sabre.

#### A prop the crew "does not touch" still has to be in the hand

The Enclave's work verb is a Force-lift, so the obvious move is to hang the stone off the
figure rather than in its fist. Two gates disagree, and both are right:
`crew-work-site` wants every rank to hold SOMETHING while working, because a rank with
empty hands on the one state the map exists to show is a rank you cannot read; and
`crew-kit-geometry` wants a part on a hand bone to actually reach the fist, because
otherwise it is an object flying alongside a person.

At the size a crew renders, carrying a stone and levitating one are the same silhouette.
Put it in the fist and spend one torus on a halo: the halo is what says which, and the
gates stay honest.

#### The work verb belongs to the theme

`working` is the state the viewer sees most, and it is the one place a theme can say what
its world does. The engine's work clip is a two-handed swing at waist height, which is a
hammer, a pan, an adze -- and for the Enclave it would have been a lightsabre used as a
tool, which is the one thing that world would never do. It became a Force-lift instead:
hands out, palms up, a stone floating at chest height with a halo tinted to that rank's
blade. Same clip, same gate, completely different sentence. Before authoring the working
pair, say out loud what this theme's people do when they are busy; if the answer is "swing
the thing they fight with", look again.

## The rank ladder

**THE LADDER IS SILHOUETTE, AND IT NEEDS TWO CARRIERS, NOT ONE.** The brigade's is toque
height -- which is Escoffier's own system, introduced so anyone walking into a kitchen
could see who was in charge, i.e. the same problem a map at forty pixels has -- plus the
LENGTH OF THE COAT, because a hat is foreshortened from behind and coat length is not.
Measure it and put the number on the page: 2.23, 2.68, 3.14, +0.45 then +0.45. A
difference you have to measure to believe is not a ladder. And an ABSENCE counts: a
commis has no toque at all, and that is the clearest rung in the set.

**A rank differs in SILHOUETTE, not in ornament count.** Adding a crest to a figure that
already carries a banner does not make a higher rank; it makes a heavier version of the same
rank, and at map scale the two are indistinguishable. Three ranks should be three shapes: hat
and banner, then a crest, then a bigger crest -- never "everything so far, plus one more
thing". The same rule kills spike escalation, which is what the Space Colony review calls out
as "more spikes / more armour".

#### The third rank may INVERT, not escalate

Two ranks establish a direction, and the obvious third move is further along it: taller,
brighter, more of the same trim. That is how the kitchen's first brigade failed -- the
rework the user rejected was, in their words, "you just changed the color of the skin."
The Enclave's third rank is the counter-example worth keeping: padawan and knight are
woven, warm, matte and hooded, and Vader is moulded, black, and the only gloss in the
roster. Nothing about him is a bigger version of the knight; every material decision is
the opposite one. The silhouette ladder still holds (the rungs measured 2.224 / 2.499 /
2.419), which is the point -- an inverted rank does not have to be the tallest to read as
the top of the ladder, because the eye ranks a figure by how much it differs from the two
below it, not by height.

The trap that comes with it: an inverted rank tends to hide the face, and **a helmet must
still carry the state.** Drive the mask from the same face table as the bare heads --
Vader's lenses and his chest lamps are `FACES` rows with a `lamp` field, so `thinking`,
`waiting` and the rest reach him unchanged. A rank whose head stops reacting reads as a
prop the moment the deck is doing anything.

#### A ladder has to separate EVERY rung

Two of the three ranks were a cream tunic under a brown robe and read as the same person
twice. The head carried them apart and nothing else did, which means the ladder only
worked at the one distance where a head is legible. Rank 0 became a scavenger in bleached
desert cloth with wrapped forearms and her hair gathered in three knots; rank 1 stayed
temple linen. Check the pair that is NOT the top rank: the third rank inverts and is easy,
and the first two are where a roster quietly becomes one figure repeated.

#### A ladder can fail at a distance the sheet never shows

Two ranks in similar wardrobes are told apart by their heads, and a head is a handful of
pixels at the size a crew is actually seen. When the first attempt at rank 1 failed, the
answer was not a better version of the same person but a different KIND of one: older, so
the head carries long hair and a beard rather than hair colour; heavier, so the body
carries hide over cloth rather than cloth over cloth. Both survive being small, which
hair colour and a hood do not. Ask of each rank what it looks like at 40 pixels before
spending a day on what it looks like at 400.

#### Build the rank ladder out of the real insignia, not out of ornament

The harbour crew was rebuilt twice. The first pass refused warm colour on the theory that it
was rationed, built the whole ladder in VALUE, and produced three grey-blue figures wearing
the same navy tube and differing by a hat. What is actually rationed is the six STATUS
TOKENS, which are measured; warm colour nowhere near them was never forbidden.

The second pass went to the reference. Naval and merchant-marine rank exists to be read
across water and does it with three devices, in this order of how far they carry: the HEAD
(a rating's cap has a woven tally and no badge, an officer's has a badge, a senior officer's
PEAK carries gold leaf -- the only rank device a camera looking DOWN can read), the CUFF
(rings of lace, counted), and the COAT (a rating's smock is single and buttonless, an
officer's reefer is double-breasted with two columns of brass). Three devices, each changing
on all three rungs, plus one colour family each: hi-vis, oilskin ochre, black-and-gold.

The lesson generalises past this theme. **A uniform tradition has already solved "make rank
legible at distance", and it solved it with more care than an afternoon of invention will.**
Go and read what it actually does before designing a ladder.

#### Borrow the domain's own answer to "tell identical figures apart"

Spaceflight has this map's exact problem -- people in identical white suits, told apart on
a camera far away -- and NASA's answer is the commander's stripe: marks on the arms and legs
of the lead spacewalker. The hard upper torso, the backpack size and the gold sun visor
separate the rest. Harbour got its ladder from naval rank the same way. **Before designing
a ladder, find out how the real trade separates its people at a distance**; it will have
solved it better than an afternoon of invention.

Two corrections that came with it:

- **A domain colour can collide with the effort ramp.** NASA's stripe is red, which is
  `--status-danger`; gold, the next obvious choice, is inside the effort ramp and merged with
  the effort band beside it. The stripe went charcoal, which the ramp never reaches.
- **A visor that is part of the helmet cannot be judged by the face rule.** The face check
  asks "does anything stand proud of the skull over the face patch", and on the built-in the
  HELMET is the skull and the visor is a screen with the face drawn on it. The honest test
  there is "is the face part itself visible", not "is the patch clear".

## Colour, status and effort

**A STATUS COLOUR IS A STRIPE, NOT A GARMENT.** The whole apron in the effort colour gave
three figures that read as a green cook, an orange cook and a red cook rather than as
three cooks. Put it on the neckerchief, the waist tie and the hem binding: small enough
that what you see first is a person, and it is how a real kitchen colour-codes anyway.

**COUNT the parts that take the effort tint. Do not trust the switch that says they do.**
`crew.body.tint: 'none'` reads as "effort does not recolour this figure", it was set on every
theme, and it was true -- while fourteen of the samurai's twenty-seven parts each took the
effort colour individually, plus twenty-two inner pieces. On the rank plate the effort yellow
was the loudest thing on all three figures, which inverts the one rule the crew has: status
first, effort second. A visual review flagged exactly this and stated the mechanism wrongly
("recolouring the whole astronaut"), so checking the mechanism cleared it and checking the
COUNT convicted it. Name the region effort lives in, and make it countable:

    parts with tint 'suit'   harbour 2/35   jedi 2/28   kitchen 4/22   samurai 14/27 -> 3/27

Pick the region by which parts have no authored colour of their own, because those are the
only ones that genuinely need an instance colour -- for the samurai that was the lacing, the
banner and the belt, which is also the answer a person would give. And if you strip a
part-level tint, strip the `tint: true` flags on its inner pieces too: a masked piece under an
untinted part renders WHITE, and `crew-tint-mask.test.ts` is the only thing that catches it.

**The effort colour does not belong on a clothed body.** `crew.body.tint: "none"` and move
it onto the kit. Whatever you put over the mannequin, arms and legs of moulded plastic in a
bright effort colour read as a spacesuit. Put it somewhere large and high (a banner) plus
somewhere small and central (a sash); both read better at map distance than a torso did.

**Mask the fittings rather than shipping them as a fixed hex.** A part is one instanced
mesh with one instance colour, so `tint` used to be all or nothing: a dark helmet with gold
trim had to choose between a whole helmet in the session's colour and trim that never
changed. Every gold detail on the first samurai pass was therefore a literal, and the
session reached the figure only through three cloth pieces low on the body, which the user
noticed immediately. A composite piece can carry `"tint": true` now, so the fittings follow
and the lacquer does not: the part sets `tint` and `material.vertexColors`, and the pieces
say which of them take it. Mask FURNITURE (rims, rings, guards, crests), not MATERIALS: a
straw hat in the session's colour is not a detail following the session, it is a differently
coloured hat.

**Do not spend a per-agent colour on many wide horizontal bands.** Four coloured rings
around a dark cuirass makes a wasp, and at map size a stack of alternating rings is noise.
Vertical accents on a dark ground resolve to a thin coloured line at distance and hold
their shape.

**The contrast floor is against whatever the tone is WORN OVER, and that is not
derivable from the descriptor.** Harbour's twelve tones all clear 3:1 against
`body.color` and jedi's do too, but eleven of samurai's twelve score under 3:1 against it
and every one reads instantly, because they are carried on a back banner, a helmet wing, a
crest and a sash -- against the sky and against lacquer, never against the body. The
kitchen's apron sits on a white coat. So establish the floor against the surface the tone
actually sits on, per theme, and write down which surface that is; a floor applied to
`body.color` everywhere would fail three themes that are right.

**Every effort tone has to separate from the BODY behind it.** Whatever carries the effort
colour is worn OVER the mannequin, so a tone near the body's own colour is a tone that
does not exist. It happened twice in one theme: a slate body behind marlin `low` (a cook
on low effort wore a blue-grey apron over blue-grey legs), then a cornflower `ultracode`
at 2.5:1 against the near-black body that replaced it. Both rendered and both validated.
Put a WCAG contrast floor of about 3:1 in the generator and assert it.

**A THEME'S OWN COLOURS MAY NOT IMPERSONATE THE APP'S STATUSES.** MusterDeck spends five
of the six principal hues on state: red blocked, lime waiting, green ready for review, blue
working, violet on watch. A theme colours two other things -- a zone accent per repo and
effort as a suit tone -- and both used to be rainbows drawn from those same hues. Measured
in CIELAB, six of twelve zone accents sat under dE 23 of a status token and the effort ramp's
`low` was dE 8.3 from `--status-working`. On screen that is a repo whose kerbs are the colour
of "blocked", and a low-effort figure wearing the colour of one that is mid-turn.

`tests/unit/renderer/crew-palette-clash.test.ts` is the gate, and it runs over every shipped
theme plus the engine fallback: **dE 26 from all six status tokens, dE 20 between any two
zone accents, twelve zone accents exactly, and an effort ramp whose every step is further
from the ramp's bottom than the last.**

Three things that gate teaches, which are worth knowing before you pick a single hex:

- **The blue band is unavailable.** `working` (a bright blue) and `spawning` (a dim navy)
  between them occupy 185-235 degrees at both ends of the lightness range, so every
  candidate there that cleared the gate was a near-black slate -- useless for a kerb that
  has to glow after dark. Spend your twelve in the four bands status does not use: fired
  earth (4-66), moss to fern (76-110), verdigris (150-192), plum to oxblood (256-350).
- **Hue distance alone lies, which is why the gate is in Lab.** A dim navy and a bright
  azure are 5 degrees apart and never confusable; two mid greens 20 degrees apart are the
  same colour to anyone not comparing them side by side.
- **An effort ramp is ONE family climbing, not a rainbow.** Effort is a quantity, so more of
  it has to look like more of something -- and "more" can be lightness (the space colony's
  ice ramp) or chroma (the village's fired one), which is why the test measures distance
  from the bottom of the ramp rather than lightness. `ultracode` is not hotter than `max`;
  it is a different mode, so it leaves the ramp rather than competing on heat.

One thing the gate does NOT see: a kerb is emissive and goes through bloom, so it renders
brighter and more saturated than its authored hex. The gate keeps the HUE clear; check the
bloomed result on `/probe.html` before you call a near-miss fine.

#### A palette gate measures the colour, not the area

The palette test passed the built-in's effort ramp: every step at dE 26 or more from every
status token. It was also wrong, because that ramp was painted over 100% of the figure. A
colour that is fine on a 2px pip -- clear by a tenth of a unit -- is not fine as an entire
astronaut, where it makes a max-effort session read as a blocked one across the map. The
gate cannot see this; the rule that catches it is the old one about stripes. **The effort
colour belongs on small, high parts** -- bands, a neck ring, a neckcloth -- and a body or a
helmet tinted `suit` is the fault regardless of what the numbers say.

#### A theme renames a status; it does not recolour one

`crew.look[status].trim` and the app's `--status-*` tokens are two renderings of one fact.
Working is blue in both places or the map is lying about the thing it exists to report.
Nothing had been stopping them drifting -- every theme happened to inherit the defaults --
so `crew-status-colour.test.ts` now pins it, reading the NORMALIZED theme because a theme
that overrides nothing still HAS a colour and that is what reaches the screen.

The same test found the other half: **two themes carried the status colour nowhere at all.**
Everything tinted on the Enclave and the kitchen was `suit`, which is EFFORT, so a jedi
mid-turn and a jedi blocked were the same figure. Every theme needs at least one part
tinted `trim` or `pulseTrim`, worn by every rank -- and prefer `pulseTrim`, which breathes
between 0.7 and 2.3 of the colour. A flat 0.05 lens is technically present and, on a figure
2.2 units high, invisible.

#### The theme's word leads, the status key follows in brackets

Renaming the states is what makes a theme feel like somewhere: a harbour says "Aground", a
kitchen says "86'd". The cost is a second vocabulary for something the reader already
knows, and the two are not guessable from each other -- nothing about "Made port" says
`celebrating`, and a harbour uses "On watch" for BOTH `working` and `watching`, which are
different states with different colours. So `statusLabel` in `game/crew.js` renders
"Made port (celebrating)", and drops the bracket when a theme has not renamed that state.

**The status cord takes its colour from `crew.look[<status>].trim`.** A working, waiting or
blocked building gets a cord strung round its scaffolding in that colour, so a theme cannot
end up with a building and its own astronaut disagreeing about what "blocked" looks like.
Shipped, idle and dormant get no cord at all -- if your trim colours are only tuned for the
figure, check them at map distance on a ring as well.

**WAITING IS THE ONE STATE THAT IS ABOUT THE VIEWER.** Both themes had it as weight
shifting foot to foot and a glance off for whoever is late: a good drawing of somebody
killing time, and exactly backwards. This state fires when a session is BLOCKED ON YOU,
and the figure's whole job is to get your attention across a map you are not looking at.
It faces front, raises its free hand and WAVES -- the free one, because the other is
holding something. Nothing else in the set may wave, which is what makes it legible at a
glance rather than one idle among several. And raise it with the SPREAD, not with
`rotation.x`: the latter swings the arm forward about the shoulder's side axis and the
hand arrives in front of the face, covering the one part of the figure this state needs
you to read.

**NUMBERS DO NOT TRAVEL BETWEEN THEMES.** The wave's spread was tuned to 2.62 on a toque
0.30 across and buried the upper arm 0.05 into a kabuto, which is 0.48 at the cheek
guards. Re-sweep every state after porting a pose, and expect to re-tune.

## Materials and light

#### Clearcoat, not chrome

Black armour went out as a mirrored droid twice before the numbers were right. The cause
is that three separate knobs all mirror the environment and they compound: `metalness`
turns the surface into a reflector, a full `clearcoat` lays a second one on top, and
`environmentIntensity` decides how bright the room it is reflecting is. With a
`RoomEnvironment` -- which is a bright studio box -- 1.0 on any two of them and the part
stops having a colour at all.

What shipped: `metalness: 0`, `clearcoat: .24` on the cloth-adjacent pieces and `.34` on
the helmet, `envMapIntensity: .09` to `.12`, `roughness: .46` / `.36`. Lacquer is a dark
diffuse surface with a thin bright highlight; it is NOT metal, and the way to get there is
to spend everything on the highlight and almost nothing on the reflection.

#### A clearcoat with no roughness is a mirror

Four rebuilds of one black helmet came back as chrome, and the cause was a default.
three.js sets `clearcoatRoughness` to **0**, so ANY `clearcoat` value adds a perfectly
sharp second specular lobe on top of the base one. Dropping the base roughness never
helped, because the base was not what was shining. A coat needs its own roughness or it
is glass. Everything else the earlier passes blamed -- metalness, environment intensity,
the key light -- was real but secondary.

#### A recess gets no clearcoat

The grille's recess rendered as a WHITE tile on a `#0f1013` albedo -- 0.70 sRGB on
near-black -- and nothing about the material was wrong anywhere else on the figure. A
clearcoat lobe that reads as a sheen TRAVELLING across a large curved shell covers the
ENTIRE face of a small flat one, because a flat facet has a single normal and either
catches the lobe or does not. Anything recessed, interior or facet-sized gets a separate
matte material, which is also true of the thing itself: the inside of a vent is not
polished. Two checks to run once the gloss is tuned on the big forms: look at every small
flat part, and sample the pixel rather than trusting the hex.

#### Bloom threshold is a BUDGET, spent in linear HDR

`UnrealBloomPass` thresholds the scene BEFORE tone mapping, so the numbers it compares
are linear radiance, not the 0-1 you see. Lit white cloth sits around 1.5 there. A
threshold of 0.90 therefore does not mean "only the glowing things" -- it means the robes
bloom, and the first Enclave build had a padawan whose tunic glowed as much as his blade.
The fix is to treat the threshold as a floor that the emitters must clear on purpose:
emissive intensities raised to 5 to 7 (`glow()` strengths 5.4 / 4.4 / 5.0, cores 7.4 /
6.0 / 6.8), threshold to 2.0, strength .58, radius .46. Set the threshold above the
brightest NON-emitter in the scene, then raise the emitters until they clear it -- never
the other way round.

#### A blade is the brightest thing in the frame, not the only thing

The green blade at the blue's strength did not light the knight, it ERASED him: a
figure-shaped glow with no tunic, no hair and no face. Green is the channel an eye is
most sensitive to and the one a bloom pass has the most of, so **emitter strengths are
per colour**, not one number for the set (4.6 / 3.2 / 4.4 here, cores 6.4 / 4.6 / 6.0).
The light the emitter casts is a second budget and a smaller one than it looks: 1.5 on a
point light six inches from a chest is a floodlight, and 0.85 was the number that left
the figure holding the thing still visible.

**A `glow` part is one colour.** `material: "glow"` is not configurable: the engine hands
back a flat `MeshBasicMaterial` with no `vertexColors`, because the point of it is to be
unlit and over-bright for the bloom pass. A composite's per-piece colours live in a
vertex-colour attribute, so on a glow part they are read by nothing -- every piece comes
out the instance colour and the hexes are dead text, and a `"tint": true` mask is baked
and never sampled. A lightsabre's hilt and blade were one glowing part and the machined
steel and black grip both came out as a bar of crystal light: a sabre with no handle.
Anything that glows and has detail in it is TWO parts sharing an `at`, a `rot` and a
`wear`.

#### A lens seen end-on is a disc, and a disc is a medal

The signal lamp was built along the figure's own Y, so its lens showed as a flat circle on
the chest: a medal on the master, a button on the deckhand. Turned to face +Z it reads as a
lamp immediately. And the lens has to sit IN FRONT of its bezel, not inside it -- a `cyl` is
solid, so a lens set into the rim is a lens nobody sees, which is the whole point of it.

The general form: **ask which way a thing POINTS, and point it at the camera.** Anything
whose meaning is on one face -- a lens, a dial, a badge, a screen -- is worth nothing edge-on.

## Buildings and the world

**A young building must be SMALL, not UNFINISHED.** The two look nothing alike and the
difference is one word in the spec. Stage 1 is a complete building of its kind at its
smallest honest size; the later stages show investment in something that already worked.
Staging by construction order gives the opposite of this and gives it silently, because the
recipe is still correct and every test still passes: the operations hut's first pass put a
sealed box with no door and no windows on the map at stage 1, and since the hut is the most
common building in that theme, the whole village read as a building site. The test is "could
one person do this building's job in it tonight, in the rain" and it is applied in step 4,
in words, before any JSON exists.

#### "Complete but evolving" is TWO rules, and the second one has a number

Stage 1 complete is half of it. The other half is that stages 2 to 5 improve the
BUILDING, and a theme can pass the first half completely while failing the second
without anyone noticing, because a strip of five stages that all look finished looks
right until you compare them.

There is a cheap measurement: **the bounding volume each stage adds, as a share of the
finished building.** The Enclave measured

    temple   97.9  0.8  0.3  0.8  0.2
    hall     98.3  1.0  0.1  0.1  0.5
    archive  98.8  0.2  0.2  0.2  0.6

Six of ten put ninety-odd per cent up at stage 1 and then spent four stages adding one
to three per cent, and what they added was a floor mat, a water butt, three rocks and a
bench. **The plot got furnished and the building never improved.**

Volume is a proxy, not the test -- a stair on an enormous ziggurat is honestly small, and
that building still reads as growing. Use the number to find the suspects and the strip
to judge them.

Two named failure shapes to check for by eye:

- **RE-DEALING.** The monolith gained one 0.34-wide inscription stripe at stage 1, the
  same stripe at 2, and the same stripe again at 3. That is one step dealt three times.
- **FURNISHING.** A mat, a jug, a bench and a crate are things that arrive at a finished
  building. They are what stage 5 is for, not what stages 2 to 4 are for.

And one thing that IS allowed: **stage 5 may be age rather than improvement.** By stage 4
a building should be complete, lit and approached, so what a fifth stage can add is time
-- moss, vines, a fallen stone. Say so deliberately rather than letting it happen.

**RE-DEALING THE EXISTING STEPS CANNOT SATISFY BOTH HALVES OF THIS, and it is worth being
blunt about because it is the obvious thing to try.** Stage 1 wants five or six pieces, and
point 3 below wants four stages of investment in a building that already works. A ten-step
recipe has four left over, which is a beam, a post and a lantern. A review of the samurai
village tried three different deals of its ten steps before this was believed: by
construction order (stage 1 a slab and a box), by what a piece IS (stage 1 a foundation),
and then by hand per recipe, which stood every building up and still left HOUSES WITH NO
DOOR, because the recipe has one door and there are five stages to fill. Every one of those
passed its tests. So when the words in this step ask for more building than the recipe
holds, the answer is more building: the samurai evolution came out at 128 steps against a
shipped 103, and about a fifth of that is stage 1 alone.

**Four faults that only a render finds, all from the 37 buildings this process has now
been run on.** Each validated, each passed every test, each looked wrong:

- **A piece on a face the map camera never sees.** The standard yaw shows a building's +Z
  front and one long side, so anything on the far gable is invisible in play. The operations
  hut's number board -- the one piece carrying its identity -- was on the +X gable.
- **A piece INSIDE another piece.** The jedi archive's four glowing shelves were authored at
  z 0.62 and 0.63 inside a VOID recess spanning 0.61 to 0.71, so the one thing that says
  what that building is never rendered at any stage. Compute the FACE you are placing
  against, not the centre.
- **A piece in another piece's colour.** The hut's porch posts were the door's own timber at
  nearly the door's width, so the facade read as three brown bars. A fitting that matches
  what it stands beside reads as part of it.
- **A rail with nothing holding it up, and a roof with nothing under it.** The dish pit's
  wall rack floated 0.56 above its unit; the samurai watchtower's roof sat 0.34 above its
  platform, because the RAILS that fill that gap arrive at stages 2 to 4. If a stage-1
  render has a gap in it, stage 1 is missing a piece. **Ask this per STAGE, not of the
  finished building**: that watchtower roof looks perfectly held at stage 5, because a
  corner post runs up through it, and that post arrives at stage 3.
- **A fitting hung off the wrong measurement.** The same fault as the two above and the
  easiest to write, because the number you want is usually in scope under another name. The
  storehouse's tally board was placed at the FLOOR's half-depth and a kura's floor oversails
  its walls by 0.2, so the board stood 0.1 clear of the wall it is nailed to. Take the face
  off the piece the fitting is fixed TO, and assert the relationship (`face < floor / 2`)
  rather than trusting that they are the same building.

**And one the arithmetic finds first, which is cheaper.** Check every new piece against the
slot allowance, `1.81 / world.scale`. A recipe over it is scaled DOWN uniformly by
`createBuilding`, so one decorative piece flung wide shrinks the whole building on six of a
zone's seven slots. Two pieces authored in this pass did exactly that before an assert
caught them, and samurai was already over on nine of its ten recipes.

**A ring scatters by default, and a ring is not a rectangle.** `jitter` defaults to 1, which
randomises angle and radius by up to 15%: right for dumped crates, wrong for the four posts
holding up a tower, so a structural ring needs `jitter: 0`. Even pinned, a ring of four puts
its members at the MID-POINTS of the edges -- the kitchen's prep table had two of its four
legs standing 0.17 outside the worktop they carry. Legs go on a `grid`.

**A ring or a grid takes the step's own `x`, `y` and `z` as well as its members'** -- since
this was fixed. It did not until a review read the engine against the data: only the inner
object was being spread, so `{ grid: {...}, y: 1.17 }` put the dry store's top-shelf sacks
in a heap on the floor, and the training hall's and tea house's veranda posts stood at
ground level a plinth's height short of the roofs they carry. Five places across four
descriptors, every one of them authored on the obvious reading, and nothing warned because
every value involved is legal. Worth knowing because it is the shape of bug this whole
process is bad at: **invisible in a render**, since a heap of sacks on the floor looks
exactly like a heap of sacks on the floor. What caught it was asking the ARITHMETIC whether
each piece touched anything, per stage.

**Pieces that are one object belong in ONE stage.** The commonest fault after the missing
roof, and the hardest to see in a descriptor. The jedi archive had four shelf rails at
stages 2,3,3,4 and the four lights that sit ON those rails at 4,5,5,5 -- one stage of empty
shelves, a later one of light with nothing under it. The larder had jars at stage 4 and
their LIDS at 5. The great temple had seven stair treads over three stages, so its approach
stopped in mid-air at every stage below 5. A torii had ONE POST at stage 1, a pass had one
gantry leg, a speeder one of two turbines.

**The mechanical constraint that shapes all four.** Steps are strictly additive and a test
pins geometry as monotonic, so the core massing can never be re-proportioned, shrunk or
replaced. Growth therefore comes from **extension and equipment**, never from the walls
getting taller. This is the right constraint rather than a limitation: it is what keeps the
stage-1 building legible inside the stage-5 one, which is the difference between a building
that evolved and a building that was swapped. If you ever genuinely need a piece superseded
(a tin roof becoming tiled), that needs a stage RANGE rather than a floor and it costs the
guarantee that two stages share byte-identical geometry, so raise it as a decision instead
of doing it quietly.

**A step's `y` is its BASE, after it has been turned.** `core/shapes.js` applies rotate,
then stretch, then shift, then base, so a piece is dropped until its lowest point sits at
`y`. This matters the moment a theme lays a cylinder on its side for a rope, a rail or a
drum: anything that places a piece at `y + h/2` from the AUTHORED height is right for a
post and wrong for all three, and a review harness that did exactly that floated a bamboo
rail a third of a metre above its own fence posts. Any second renderer of this DSL wants
the same four steps in the same order.

**Author the recipes as GENERATORS, one file per theme.** `tools/crew-sheet/evolve/` is
the model: each file reads the measured dimensions off the existing steps rather than
restating them, computes every placement from those numbers, `assert`s the things that are
easy to get wrong and impossible to see, and keeps the words next to the geometry. The words
are not a comment there -- `evolve/notes.py` parses the docstrings and `build-atlas.py`
renders them, so the artifact's prose and the geometry have ONE source. Two copies of a spec
is how a page ends up describing something the geometry stopped doing three versions ago,
which this page has done before.

**A STATION WITH NO WORDS IS A STATION NOBODY CHECKED.** The kitchen's bar was skipped by
its first pass on the reasonable grounds that it was already right, so nine of the ten
stations had a spec and one had nothing. Writing its five stages down took ten minutes and
immediately turned up a beer tap whose BODY was at stage 3 and whose SPOUT was at stage 4 --
the one-object-two-stages fault that the same file calls out by name for the dry store's
jars and their lids. Knowing a rule and applying it to every recipe are different jobs, and
the words are what makes the second one happen. Write up the ones you think are fine.

**A COUNT ASSERT CANNOT GUARD A BUILDER THAT ADDS NOTHING.** `assert len(s) == 14` is how a
builder refuses to run twice, and it works because most builders add geometry. A builder
that only RE-DEALS leaves the count where it was, so it will happily run again -- harmless
when it is idempotent, which is worth checking rather than assuming.

**A REVIEW FINDS FAULTS IN GEOMETRY A BUILDER HAS ALREADY PRODUCED**, months later, and
those cannot go in the builder: it asserts the un-evolved shape and will never run again.
`kitchen.py` grew a `REPAIRS` table for them -- each one asserting the EVOLVED shape it
expects, each run by name (`python3 kitchen.py range-rail`), each carrying the reason. The
first was a pan rail hanging from nothing: the builder asserted only that it cleared the
burners, so it floated 0.185 under the extraction canopy with no drops, and its hooks sat
0.06 below the rail they hang on. Assert what HOLDS a piece up, not just what it avoids.

**WRITING THE GENERATOR IS NOT RUNNING IT.** `evolve/samurai.py` existed, complete and
correct, for long enough for the theme to ship twice with stage 1 as a slab and a box,
because nothing had executed it: the descriptor is the source of truth and it had never
been written to. `common.py` says RUN ONCE, AGAINST THE UN-EVOLVED DESCRIPTOR, and each
recipe asserts its input shape so a second run fails loudly rather than stacking a second
porch on the same hut. Check the descriptor's own step counts afterwards; that is the only
evidence that anything happened.

**A building is scaled down to fit its slot, so a footprint is a request.** A zone is a hex
cell offering seven slots: the middle one has about 6.2 units of room, the six on the ring
have about 1.8. The largest shipped recipes are around 2.9, so they are comfortable in the
middle and 60% too big for the ring, and `createBuilding` shrinks them. Author to the middle
and check the ring: a recipe whose detail only reads at full size needs a footprint under
about 1.8. Raising `world.scale` to make one building read pushes more of them past that.

**Pick `world.scale` from what the theme BUILDS, not from the other themes.** A crew
builds architecture and a village builds houses, so both sit near 1.45. A kitchen builds
furniture, and at 1.45 a prep bench came out 1.4 cooks tall -- a table you cannot see
over, which reads as a crate. Work out the height of the most ordinary thing in the theme,
divide by the cook (2.2 x `crew.scale`, so 1.23 at 0.56), and set the scale from that. A
happy side effect when the number comes out small: nothing exceeds a ring slot's 1.81, so
no recipe is ever scaled down and every one keeps its detail in all seven slots.

**The zone floor is the largest object on screen, so its accent is a colour budget.** `tint`
is how much of the repo accent multiplies through the floor, and the plate default was 1.0 --
the accent owned the floor outright, on the entirely true reasoning that the plate is drawn
neutral grey precisely so it can. True about the surface, wrong about the view: a repository's
identity never changes, the status of a session does, and the floor was out-shouting the thing
the map exists to report. Every author who set this by hand had already gone lower (soil 0.22,
jedi 0.34, kitchen 0.45). The default is now 0.5 and the accent does its naming from the rim.

**The zone floor is yours too.** `world.floor` picks `plate` (bolted metal) or `soil`
(beaten earth), each with its own colours and, more importantly, a `tint`: how much of the
zone accent multiplies through. The plate deck is authored neutral grey precisely so the
accent can own its colour, and that is `tint: 1`; do the same to a beige floor and a zone
whose repo name hashes to teal gets teal dirt. Soil defaults to `0.26`. Judge it at map
height, not up close: the first soil pass was two stops lighter and read as poured concrete
from the only distance anyone actually sees it from.

**A zone has to sit against its ground.** The zone floor and the world's terrain are
chosen in different places and nothing compares them. Terracotta tile on warm brown earth
meant that from map height -- the only distance most people see it from -- the zones
stopped reading as floors at all and the crew looked like bare terrain with furniture
scattered on it.

**Three things the evaluator does that the reference does not say**, each of which fails
silently and each of which cost a render cycle:

- **A `ring` or `grid` member's own `x` and `z` are REPLACED, not added to.** The
  container's `x`/`z` offset the whole set and its `y` is inherited when the member has
  none (`placed()` in `world/recipes.js`), but anything the member says about its own x
  and z is thrown away, and a `ring` overwrites its `ry` with the tangent angle.
- **`cell` does not take the `["pick", ...]` form** that every other number accepts:
  `cellIndex` reads a name or a number, and anything else falls back to the default cell.
  Vary a colour with `any`.
- **Read the evaluator before trusting a key.** `PLATE.panel` was documented, defaulted,
  and never read by anything for two themes. If a key seems not to do anything, grep for
  it in `world/recipes.js` and `world/surfaces.js` before assuming you used it wrong.

**`mergeGeometries` refuses a mixed set.** Every member must agree on being indexed *and*
on its attribute set. A hand-built primitive without an identity index, or without a `uv`
channel that three's primitives all have, merges the whole building to `null` and it
silently does not exist. That cost six buildings once. `core/shapes.js` handles the shapes
that exist; if you add a primitive, give it both.

**An over-driven scatter tint needs the triple form.** The tint multiplies the kit's atlas,
and the foliage is painted green, so green times any hex red is a dark olive. A channel
above 1.0 (`[2.6, 1.15, 0.5]`) is the only way to get autumn. Watch out for anything that
round-trips through HSL on the way: for a channel sum over 2 that computes a negative
saturation and returns a colour unrelated to what you asked for.

#### Dead cells are free colour

Six of the Enclave's thirty-two cells were declared and never referenced by a single
step. The atlas is a fixed 8x4 grid, so a new colour cannot be appended -- it has to take
a slot. An unused slot costs nothing, and counting usage takes one pass over the
recipes. Do that before deciding a theme cannot have the colour it needs.

**A KIT BUILDING IS STAGED LIKE ANY OTHER, AND THE KIT MAKES STAGE 1 EASY.** Every
`basemodule_*` arrives sealed, airlock and windows drawn, so a module alone is an honest
stage 1; the discipline is the other half. Keep the airlock face (+Z, the face the map
camera shows) clear of everything the evolutions add; add ROOF modules as an evolution,
never stacked on another roof module (they share a plate and z-fight); and measure kit
parts off the glb's accessors, because `common.reach` only knows primitives
(`evolve/colony.py` has the table and a `kit_reach`). Two independent `chance` rolls are
not a choice: the colony's pad was large at 0.65 and small at 0.35, so a quarter of pads
had both and a quarter had none. Use `any` with `weights`, or one part.

#### A ship is not a recipe, and it is not drawn by one

`world/ship.js` never calls `buildRecipe`. Its steps say `paint:` against `ship.surfaces`
and `lit:` for the pieces that glow, where a building step says `cell:` against the world
atlas. Two consequences that cost real time:

- Anything that renders the arrival point OUTSIDE the app has to port the ship's own path.
  Feeding ship steps to `buildRecipe` gives every piece atlas cell 0, which on a dark theme
  is a landing point that renders as a silhouette and looks like a lighting fault.
- **A ship step STANDS ON its `y`; it is not centred on it** (`base: step.base !== false`).
  A band course authored at y 2.90 with a height of 0.5 occupies 2.90 to 3.40 and its middle
  is 3.15. Centring a sign on 2.90 put half the wordmark on the wall below the band -- one
  look to see, and invisible in the arithmetic unless you know the rule.

## The harness, the pipeline and the artifact

**THE HARNESS HAS TO BE SHOWING YOU THE THEME, and twice it was not.** Both were silent
and both invalidated every plate that had ever been taken of the affected theme.

- All four pages fetched the SHIPPED theme index, so `themes/unshipped/` -- which is where
  a theme lives while it is being reviewed -- rendered no plates at all. The kitchen's crew
  went through two authoring passes without once appearing on a sheet. `register-themes.js`
  loads both now.
- The pages called `loadCrew()` with no argument, which bakes the DEFAULT drop set and
  never bakes again, so every theme was photographed on the same mannequin whatever its own
  `crew.body.drop` said. The app re-bakes on every theme switch. The first render of the
  kitchen's dropped arms still had the mannequin's black fists inside the kit's own skin
  hands, on a page whose whole promise is that what you photograph is what ships.

**A CREW BUILDER WRITES THE CREW.** `build-galley-whites.py` rebuilt the WHOLE descriptor
from `G.theme()`, so running it -- the documented way to change a kit -- would have deleted
25 steps of building and flattened all ten stations back to one unstaged pile, undoing a
pass that had shipped in between. It loads the descriptor and replaces `crew` now, and
asserts that `world` came out byte-identical. Its own docstring warns about exactly this
trap one level up; a generator that regenerates more than it owns is the same trap.

`/figure.html` renders the three ranks on the real rig and is the page to use now;
`/samurai.html` (one kit per rank from four angles plus the cloth in motion) is the older
sheet. Whichever you use, keep these:

- **Render the WORKING state too, not just idle.** A sheet rendered only in `idle` never
  shows the working half of a `when: "working"` / `when: "resting"` pair: `samurai.js`
  showed a katana for two themes and its adze never once, and a drawn lightsabre -- the
  whole point of the theme that found this -- was invisible there. Held parts key off the
  ACTIVITY now (`activityFor(status)`), so set the STATUS to `working`; on the old sheet
  the clip had to be forced as well, because locomotion wins over status.
- **Review the three ranks as ONE contact sheet per theme, front view, first.** The
  question asked of a rank ladder is comparative, and the whole answer is in one image:
  `<theme>-ranks-front` from the dump (`scripts/grab-plate.mjs`). Part COUNTS lie about
  this -- jedi's three ranks wear 16 parts each and are the most strongly differentiated of
  the four themes (a padawan with a braid, a hooded knight, a helmeted Vader with a cape),
  while the kitchen's ranks share 18 of 21 parts and differ by one hat, which turns out to
  be enough because the hat triples in height. Look, do not count.
- **One figure per scene.** Three ranks in one scene along X works for a front view and is
  useless for a side one, because the camera then looks straight down the row.
- **Plant the agents** before rendering: an idler drifts around its plot and turns wherever
  it fancies, so an unplanted comparison sheet is three figures at three angles in three
  places, and fixed cell framing cuts them apart.

To photograph cloth in motion, set `agent.walkAmp` / `agent.turnRate` and then call
`crew._writeMatrices(...)` **directly** -- both are recomputed from actual travel every
`_step`, so they cannot be set from outside and survive an `update()`.

#### Port with a PATCH, never with the generator

`examples/build-<theme>.py` builds the whole descriptor -- crew, recipes, worlds, ship --
so running it to update the crew deletes every pass of building work since. The kitchen's
whites builder was rebuilt for this reason and the lesson did not travel. A port reads
the shipped parts, replaces the ones the review changed, and asserts that `world` and
`ship` come out byte-identical.

#### The harness has to DROP what the theme drops, or it hides your own work

Half an hour went on "why are the deckhand's sleeves black". They were not black. They
were not there: `crew-sheet`'s body proxy draws an arm from the shoulder to the wrist at
radius 0.115 to 0.10, and it did not honour `crew.body.drop`, so a 0.098 forearm authored
against an arm the ENGINE deletes sat inside a limb only the HARNESS draws. On a navy kit
nobody had ever noticed, because a dark sleeve over a dark proxy looks like a sleeve. On a
cream one it is a black stripe down a pale arm.

Two rules out of it. The proxy SKIPS a dropped part now (a `ghost` option draws it as a
wireframe while you are authoring against the volume; left on, a reviewer reported it as
black strings down the arms). And when a part does not appear, **paint the proxy magenta
before you touch the part**: one screenshot separates "my geometry is wrong" from
"something else is in front of it", and that question had been guessed at four times.

#### The face is engine-wide, and a harness that draws its own is lying

`agents/faces.js` has sixteen expressions and a loop per status -- `working` cycles
work/work/work/happy, `blocked` cycles error/error/sad/error -- and it applies to every
theme. A review surface that hand-draws one smile shows a figure grinning through a
blocked session, which is the one thing the face exists to say. Use the engine's atlas.

#### The engine hands back finished objects, twice now

`drawAtlas` returns a `Texture`. `buildFaceAtlas` returns a `Texture`. Both were wrapped in
`new CanvasTexture(...)` by a caller assuming they returned canvases, and both failed the
same silent way: a texture whose image is another texture uploads nothing, so buildings
rendered black and faces rendered as blank skin, with no error either time. Check what a
builder returns before wrapping it.

Related, and the same afternoon: **a pre-built bundle goes stale silently.** The review
page read a checked-in `engine.bundle.js`, so an edit to its entry point changed nothing
until somebody remembered the esbuild line -- and the symptom was again a blank face with
no error. `build.py` re-bundles every run now.

**Buildings authored from PRIMITIVES are cheap to view; kit buildings now are too.** A
recipe that only uses shapes (`box`, `cyl`, `prism`, `plate`, `ring`, ...) rebuilds in a page
with no assets. A recipe naming `part:` entries from a shipped GLB used to be listed and
skipped, which is why the built-in colony went three staging passes without anyone seeing
that none of its buildings grew. `review/build.py` now embeds any `builtin:` kit a recipe
names as a data URL, and the page mounts it with the engine's own `loadKits` before drawing
(the colony page is 2.5 MB for it). Prefer primitives for a new theme all the same; a kit
still has to earn its place.

**THE REVIEW'S three HAS TO BE THE APP'S three.** The page's import map pinned 0.160 while
the app runs 0.185, and the kit loader died on `getComponent is not a function`, a method
the older build does not have. Bump the import map with `package.json`.

**A CONTACT SHEET BEATS TEN SCREENSHOTS.** `window.__B.sheet(ids, stages, w, h)` on the
review page renders any buildings at any stages into one PNG data URL; an id may also be a
recipe OBJECT, which is how a generator's output (or a single kit part,
`{ id, steps: [{ part: 'x' }] }`) is looked at before it is written anywhere. The canvas does
not keep its drawing buffer, so each cell is rendered and copied in one tick; a plain
`drawImage` of the live canvas copies black.

#### An artifact cannot `fetch`, not even its own data

claude.ai serves an artifact under a CSP whose `connect-src` refuses `fetch()` of a data
URL AND of a `blob:` URL, and GLTFLoader reads everything through `fetch` -- the embedded
kit's geometry and then the texture it unpacks from it. So a page that drew every building
locally drew none of them published, with nothing on screen to say why. The review answers
those requests from memory for the length of a load (`withLocalData` in the template). Test
a page before publishing by adding
`<meta http-equiv="Content-Security-Policy" content="connect-src https://cdn.jsdelivr.net">`
to a local copy; that reproduces the failure exactly.

#### The built-in is a theme too, and it was the only one never reviewed

`SPACE_COLONY` lives in `core/theme.js` as source, not as a descriptor file. Every review
tool in this repo -- the pose sweep, the crossing check, the review page, three of the unit
gates -- iterates descriptor FILES, so the one theme every other theme inherits from walked
straight past all of them. When it was finally reviewed it had the worst faults in the repo:

- **the whole figure in the effort colour** (`body.tint: 'suit'`), with `effortTones.max`
  at dE 26.1 from `--status-danger`;
- **a ladder of three parts and then two**, the third rank being the second with a bigger
  pauldron and a cape;
- **empty hands at rest** on every rank.

`tools/crew-sheet/dump-builtin.mjs` writes it out as JSON so it gets the same tooling (its
header has the two commands: it has to be bundled, because the engine reads Vite's
`import.meta.env`). The gates that matter now include it by `normalizeTheme({})`, which is
also exactly the right thing to assert -- what a theme that overrides nothing actually gets.
**Any new gate that loops over theme files has to add the built-in to the list.**

#### Interactions: the app owns the library, the theme picks

`visits.js` already walks an idle figure over to another idle figure. `interactions.js` is
what they do when they get there, and the split is deliberate: a greeting is a greeting
anywhere, and only some places fight. A theme names up to five from the library and gets
`greet` if it says nothing; unknown names are dropped rather than honoured, exactly as
`body.drop`'s are, because a typo would otherwise fail at the moment two figures met.

Three rules that are easy to get wrong:

- **NEVER USE `wave`.** It is the `waiting` state -- a session blocked on you, waving across
  a map you are not looking at -- and it reads at a glance only because nothing else waves.
  `interact` is baked, addressable and selected by nothing, which is what it is for.
- **The two halves play DIFFERENT clips.** Two figures on the same clip in step read as a
  rendering bug rather than as a greeting.
- **An interaction is never `activity: 'working'`.** That drives `when:` parts, and a spar
  claiming to be work puts the samurai's mallet in the hand holding a sword.

The decisions live in a module of pure data and arithmetic, like `visits.js`, because the
engine is unchecked JavaScript no test can mount -- but a table and a clock can be tested.
