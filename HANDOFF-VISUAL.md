# Visual Handoff — Task Organism

For the designer picking this up. You do not need to read TypeScript to change
how this looks.

**What the project is:** a spatial task manager where each unfinished task is a
small creature living about 2.4 m in front of the user. Ignored tasks grow
restless. The single most urgent one walks toward the user. Completing a task
releases its creature.

**Tone, because it governs every visual choice:** creatures are small carriers
of obligation, not monsters or debt collectors. The one that approaches behaves
like a cat asking for attention, not a bailiff. Completion is release and
gratitude — never death, punishment, or a reward chime. Words to avoid entirely
in any label or copy: *kill, die, destroy, can't ignore, forces you*.

---

## 1. Where to change things

### The designer panel — `Art Direction (designer panel)`

A scene object at the root of the hierarchy carrying the
**CreatureArtDirection** script. Every field is grouped and has a tooltip. This
is the main surface: edit a value, press Preview, see the result. The runtime
**reads** these — nothing overwrites your edits on initialisation.

| Group | What it controls |
|---|---|
| Palette | The per-creature identity colours |
| Habitat placement | How far away the creatures live, how far apart, and the ground line |
| Presentation scale | Overall creature size, resting vs approaching |
| Breathing amplitude | How much a creature swells as it breathes, per state |
| Posture | Squash/stretch height + width per state |
| Chase distances | How close the approaching creature comes |
| Release effect | The completion burst — duration, particles, brighten |
| Labels | Truncation lengths and panel height |

Defaults are seeded from `CreatureConfig.ts`, so an untouched panel reproduces
today's look exactly. Deleting the object entirely also reproduces today's look
— the code falls back to the same defaults.

### The creature itself — `CreatureTemplate`

A **disabled** scene object at the root. This is the clone source: the app
supports up to six live creatures, only three are authored as slots, and slots
4–6 are copied from this template at runtime. Anything you change here — the
mesh, the material, the child parts, the CreatureBehavior inputs — is what the
extra creatures become.

It is disabled on purpose so it never renders as a seventh creature. Leave it
disabled; the runtime enables each copy itself.

To change the first three creatures too, make the same edit on `MovementRoot_1`,
`_2` and `_3`. (Yes, that is four places. It is the honest state of the handoff
— unifying them is a follow-up, not something to attempt mid-week.)

### Meshes and materials

- Creature models: `Assets/GeneratedMeshes/*.glb` — `dog_lo`, `cat_lo`,
  `owl_lo`, `rabbit_lo`, `penguin_lo` (and `elephant_lo`, currently not in
  rotation — see below).
- Body material: `Assets/Materials/PetBody.mat`, driven by
  `PetBody.graphShader`. It multiplies a flat base colour by the mesh's baked
  vertex shading. **Do not edit `unlit.graphShader`** — it is shared, and a
  previous edit to it silently rendered every creature black with no compile
  error.

---

## 2. The additive display — this governs every colour decision

SPECS is an **additive** waveguide display. Rendered content *adds* light on top
of the real world; it cannot subtract. The practical consequences:

- **Black is invisible.** A near-black colour is not "dark", it is transparent.
- **Dark colours read as ghosts.** Anything low-value looks half-there.
- **Pale and desaturated colours wash out** against a bright background.
- There is **no material or mesh fix** for this. It is how the optics work.

So: keep the palette **saturated and bright**. The six current colours (amber,
cyan, magenta, green, violet, yellow) were chosen to hold up across both dark
and moderately bright backdrops.

**When recording demo video, always shoot against a dark background.** Avoid
putting bright sky or lit windows behind a creature. This is a recording
constraint, not a bug to fix.

---

## 3. What you must not touch, and why

### The domain layer — `Assets/Scripts/Data`, `State`, `Input`

This is the task logic: what a task is, when it becomes urgent, which one is
allowed to approach, what completing it does. It is covered by 12 automated
tests. **Changing it is not a visual edit** and will break the tests.

Deliberately kept out of the Inspector, so a colour change can never
accidentally alter behaviour:

- `CHASE_THRESHOLD` — how urgent a task must be before it may approach at all
- `URGENCY_AGE_WINDOW_MS` — how fast a task becomes urgent
- `LATER_SNOOZE_DURATION_MS` — how long "Later" holds a creature back
- `RESOLVE_HOLD_DURATION_S` — how long a pinch-and-hold must last to complete

If a beat feels wrong in timing, say so and let an engineer move it. These live
in `CreatureConfig.ts` and are behaviour contracts, not art.

### The single-chaser invariant

**At most one creature may ever leave the habitat and approach the user.** Not
two, not "whichever are urgent". This is the core comfort promise of the whole
concept — several creatures converging on someone's face is the difference
between a pet and a swarm. It is enforced in code and verified by tests. Nothing
in the designer panel can break it, and nothing you add should try to.

### The shared ground line — `groundYOffsetCm`

One number defines the floor. The habitat floor disc and **every** creature's
foot line both derive from it, which is what keeps them agreeing when the
Preview environment changes. It is derived from a 150 cm standing eye height.

Change it if the creatures sit wrong — but change **only this one field**. Do
not add per-creature vertical offsets to compensate for one model; that is
exactly the drift this single reference was introduced to fix, and it took a
full debugging cycle to eliminate.

### Chase stop distance

`chaseStopDistanceCm` (100 cm) is a comfort limit, not a look. Raising it is
safe. **Lowering it is not** — a creature closer than a metre in a headset is
uncomfortable.

---

## 4. How to preview a change

1. Open the project in Lens Studio 5.22+.
2. Select `Art Direction (designer panel)` in the Scene Hierarchy.
3. Change a value in the Inspector.
4. The Preview panel reloads automatically. If it does not, use the reset
   control in the Preview panel.
5. The demo story plays on its own: three seconds calm → one creature becomes
   restless → it approaches → selection → hold to complete → release.

To hold the creatures still while you frame something, set
`DEMO_AUTOPLAY_ON_START` to `false` in `CreatureConfig.ts` — or ask an engineer
to. With autoplay off, on-screen buttons let you move the habitat nearer,
further, left and right, recenter it, and start the story manually.

**Preview steals the keyboard.** Arrow keys, WASD and plain letters all drive
the Preview camera, so the staging controls are on-screen buttons rather than
hotkeys. Don't expect keyboard shortcuts to work.

---

## 5. Known visual debt — good places to start

- **Posture flattens round species.** `postureCalmHeight` (0.86) and
  `postureCalmWidth` (1.14) were tuned against a tall blob. On the penguin and
  rabbit the result reads as a squashed disc. Worth retuning per the current
  roster.
- **The elephant is out of rotation.** `elephant_lo.glb` is in the project but
  withheld from the species list: its ears flare wider than its body and its
  trunk came out a stub, so at habitat distance it reads as a flat slab.
- **The rabbit's face is shallow** compared to the owl's, which has the
  strongest sculpted face of the set.
- **Six creatures share one clone template but three authored slots** (see
  §1) — unifying that is the biggest structural cleanup available.

---

## 6. Vocabulary

| Term | Meaning |
|---|---|
| Habitat | The zone in front of the user where calm creatures live |
| Calm | A task that is not yet urgent — settled, barely moving |
| Restless / urgent | Past the urgency threshold — moves more, stays in the habitat |
| Chaser | The single most urgent creature, the only one allowed to approach |
| Release | The completion moment: the creature is let go, with gratitude |
| Slot | One of six creature positions; 1–3 authored, 4–6 cloned from the template |
