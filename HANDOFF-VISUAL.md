# Visual Handoff — Task Organism

For the designer picking this up. You do not need to read TypeScript to change
how this looks.

> ## Run this after any change
> ```bash
> node Tools/build-gate.js
> ```
> One command, one verdict. It compiles the project, runs all 19 automated
> tests, diffs the seven golden frames, and checks the release-frame cost.
> It prints what broke and which file to open. Nothing to install.
>
> It is the first thing to run after you change anything and the last thing to
> run before you hand work back. Full detail in [§8](#8-the-build-gate--one-command-for-the-whole-build).

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
  `owl_lo`, `elephant_lo`, `rabbit_lo`, `penguin_lo`. All six are in rotation,
  one per creature identity. Only the dog is a third-party asset; the other
  five are generated and carry no third-party rights (see `LICENSES.md`).
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
allowed to approach, what completing it does. It is covered by 19 automated
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

- **Per-species posture is not yet editable — the biggest gap in this panel.**
  The Inspector's posture sliders drive a single global baseline, but round
  species (penguin, rabbit, cat, owl, elephant) now use their own values from
  `PET_POSTURE_OVERRIDES` in `Assets/Scripts/Creature/CreaturePetVisual.ts`,
  which is code, not Inspector. Editing the panel's posture fields therefore
  affects the **dog only**. Exposing the rest means 36 more inputs, so it wants
  a proper per-species sub-panel rather than a flat list — the single most
  worthwhile improvement to this handoff surface.
- **The rabbit's face is shallow** compared to the owl's, which has the
  strongest sculpted face of the set.
- **The vertex budget is over, and the obvious fix is dangerous.** Five of six
  species exceed the 4,000-vertex budget (rabbit worst at 7,034), but triangle
  counts are all ~3,900-4,000. The overage is therefore **seam duplication** —
  vertices split at UV and normal boundaries — not geometric complexity. Plain
  decimation will not remove it; the fix is welding vertices at those seams.
  **That risks blending `COLOR_0` across the seams**, and `COLOR_0` is what
  makes the creatures read as volumes rather than flat cutouts. This is
  deliberate work with a real regression risk, not a tool invocation. If someone
  attempts it, the golden-image harness (§6) is the thing that would catch the
  regression — run it before and after, and look specifically at whether the
  bodies still have a light-to-dark gradient.
- **The elephant is busier than the rest** — more surface ridging than the other
  five, which reads as noise at habitat distance.
- **Six creatures share one clone template but three authored slots** (see
  §1) — unifying that is the biggest structural cleanup available.

---

## 6. Visual regression harness — run this before you commit

Every visual change in this project used to be checked by eye. This catches the
four things that break silently: grounding, facing, label legibility, and the
release sequence.

It captures seven fixed frames of the demo and compares them against a committed
golden set in `docs/golden/`.

### Running it

Ask the engineer (or Claude) to capture, because capture needs the Lens Studio
MCP tools. The comparison half you can run yourself, unattended, with no setup:

```bash
node Tools/visual-regression.js --candidate <folder-of-new-captures>
```

It prints one line per frame and exits non-zero if anything moved:

```
  01-calm-habitat     ok         changed 0.00%  meanDelta 0.00
  06-release          CHANGED    changed 7.36%  meanDelta 2.71
  03-approach         MISSING CAPTURE  ...
```

To accept new frames as the reference after an intentional change:

```bash
node Tools/visual-regression.js --candidate <folder> --update
```

`--update` accepts whatever it is given, so look at the pictures first.

### Capturing the seven frames

For each frame index 0–6:

1. Set `VISUAL_HARNESS_FRAME` in `CreatureConfig.ts` to that index.
2. **Reset the Lens.** This must be `RunAndCollectLogsTool` with `mode: refresh`.
   The Preview panel's own refresh does **not** reset the Lens — do that and you
   capture the frozen ending of the previous run instead.
3. Wait for `[VisualHarness] frame=<name> READY …` in the log. Do not capture
   before it: the post-release frame settles for three seconds, and capturing
   early gives you a frame mid-effect.
4. Screenshot to `<candidate-folder>/<name>.png`. **The folder must already
   exist** — the screenshot tool reports success even when the directory is
   missing, and writes nothing. An entire batch was lost to this once.

Set `VISUAL_HARNESS_FRAME` back to `-1` when you are done.

### Why one frame per reset

The harness does not wait for beats — it jumps the demo sequence straight to the
target state in a single call, then freezes. Nothing about a captured frame
depends on wall-clock timing, so a slow machine cannot change what a golden
image records. The mid-gesture frame pumps hold progress by an exact fraction
rather than waiting for it.

### It checks more than pixels

At every frame the harness logs assertions that an image cannot express:

```
[VisualHarness] frame=01-calm-habitat READY open=6 chasing=0 (ok) groundedOk=6 groundedBad=0 skipped=0
```

- `groundedBad` must be 0 — every creature's feet on the shared ground line
- `chasing` must never exceed 1 — the single-chaser invariant
- `open` must match the expected task count for that frame

A `GROUND FAIL` line names the offending creature and its Y. These caught two
real bugs while the harness was being built (see `prompts.md`), both of which
would have produced a plausible-looking but wrong golden image.

## 7. Vocabulary

| Term | Meaning |
|---|---|
| Habitat | The zone in front of the user where calm creatures live |
| Calm | A task that is not yet urgent — settled, barely moving |
| Restless / urgent | Past the urgency threshold — moves more, stays in the habitat |
| Chaser | The single most urgent creature, the only one allowed to approach |
| Release | The completion moment: the creature is let go, with gratitude |
| Slot | One of six creature positions; 1–3 authored, 4–6 cloned from the template |

---

## 8. The build gate — one command for the whole build

```bash
node Tools/build-gate.js
```

Everything in §6 checks pictures. This checks the whole build, pictures
included, and gives you a single yes/no. Run it after any change.

### What it reports

```
────────────────────────────────────────────────────────────────
  BUILD GATE: PASS
────────────────────────────────────────────────────────────────

  ok   1. TypeScript compile    PASS     0 errors
  ok   2. LEAF scenarios        PASS     19/19 ran
  ok   3. Golden images         PASS     7/7 frames within 1%
  ok   4. Release-frame perf    PASS     worst release frame 223.7ms (release 1 of 2, 6 creatures) vs budget 300.0ms
```

Exit code is 0 only when every stage passes. On failure it names the artifact
to open:

```
 FAIL  3. Golden images         FAIL     1 frame(s) changed of 7
        06-release          CHANGED         changed 1.84%  meanDelta 0.57
        -> Compare by eye: open .build-gate/candidate/06-release.png against docs/golden/06-release.png
```

### The one thing to understand about it

Two of the four stages need a **running Lens Studio**, and Lens Studio can only
be driven by an agent (Claude), not by a plain script — the project forbids
talking to the editor over raw HTTP, and the MCP tools that do it properly only
exist inside an agent session.

So the work splits in two:

| Half | Who runs it | What it covers |
|---|---|---|
| **Capture** | Claude, via `node Tools/build-gate.js --plan` | runs the tests, captures the frames, records the perf number into `.build-gate/` |
| **Judge** | you, unattended | reads `.build-gate/`, compiles, diffs, prints the verdict |

In practice: **ask Claude to run the build gate.** It does the capture half and
then the judging half, and you get the report. If you just want to re-check
without recapturing, run the command yourself.

`node Tools/build-gate.js --offline` skips the editor stages entirely and says
`PARTIAL` — useful on a machine without Lens Studio, but a PARTIAL verdict is
explicitly *not* a healthy build.

### Stale evidence fails — this is the point

The gate compares the timestamp of every captured artifact against the newest
edit in `Assets/Scripts`. Captures older than the last code change are `STALE`
and **fail**:

```
 FAIL  2. LEAF scenarios        STALE    captured 3 min before the newest source edit — recapture: ...
```

A build gate that can go green on last week's screenshots is worse than no gate,
because it looks like coverage. You cannot get a PASS out of this without
evidence that is newer than the code it describes.

### Stage 4, and why it is not a Perfetto trace

The release frame once cost **551ms** at six creatures — `play()` built a mesh
and created 30 SceneObjects in a single frame. Pooling that work into
`prewarm()` brought it to **224ms**. That is the number this stage guards, with
a budget of 300ms.

Perfetto found that regression, and Perfetto is the right tool for working out
*which slice* grew. It is the wrong tool for a gate: multi-megabyte traces and a
human reading slice tables. So the runtime reports the number itself —
`PerfGateProbe` logs one `[PerfGate] release=…` line per release, and the gate
reads it.

It measures only the frames just after a release, deliberately. A run-wide
maximum would be useless here, and this project has the receipts: after pooling,
the *trace-wide* max got worse (551 → 754ms) while the release itself got 59%
cheaper — that spike was desktop webcam tracking, nowhere near a release.
Gating on a run-wide max would fail on a busy laptop and pass on a real
regression.

### Why "19/19 ran" is itself an assertion

The gate lists every scenario it expects by name. A scenario that quietly stops
being registered shows up as `13/14 ran — 1 never ran: gate5-snooze-runtime-path`
and fails, rather than passing as a smaller green run.

That is not hypothetical here. `gate4` exists because twelve scenarios passed
while the composition root was being disabled on release, and `gate5` exists
because `gate3-later-snooze` passed for the project's whole life while the code
path the Later button actually calls had never run. Counting the tests is a
cheap guard against the third instance of that.

### This gate has been seen to fail

Every stage was verified by deliberately breaking it and confirming the report
named the problem:

| Stage | Break | Reported as |
|---|---|---|
| compile | type error in `CreatureConfig.ts` | `1 error(s)` + file and line |
| leaf | one scenario set to fail | `1 failed: gate4-controller-survives-release` |
| leaf | one scenario removed from the run | `13/14 ran; 1 never ran: gate5-…` |
| leaf | source touched after capture | `STALE` |
| golden | one frame subtly resampled | `1 frame(s) changed — 06-release 1.84%` |
| golden | one frame deleted from the batch | `1 frame(s) never captured` |
| perf | release cost set back to 551.3ms | `FAIL … vs budget 300.0ms` |
| perf | capture at 4 creatures | `captured at 4 creatures, needs 6` |
| perf | run with no releases | `no releases recorded` |

A verification script nobody has watched fail is not a verification script.

---

## 9. Interaction tests — gate 6

The five `gate6-*` scenarios are the only ones that test **the gesture**, rather
than the code behind it.

Everything in `gate3-*` calls `pressStart` / `pressEnd` on the state machine
directly. That skips the layer where this project's interaction defects have
actually happened: collider geometry, SIK target resolution, and the
`Interactable` wiring. Both known examples — buttons left on a default
20×20×20 collider so SIK could not tell which one was meant, and a BackPlate
whose collider swallowed the rows above it — are invisible to a test that names
the task it wants to press.

Gate 6 delivers a real pinch. SIK resolves it against the real collider and
routes it to the real `Interactable`, exactly as a hand would.

| Scenario | What it drives |
|---|---|
| `gate6-pinch-select` | short pinch on a habitat creature selects it |
| `gate6-pinch-hold-resolve` | select, then hold past the threshold — one save, one release |
| `gate6-pinch-early-release` | hold released early cancels, selection kept, nothing written |
| `gate6-pinch-miss` | pinch into empty space writes nothing and hits no other creature |
| `gate6-moving-chaser` | the approaching creature is acquired **while moving** |

### Proof they catch what gate3 cannot

The creature collider was shrunk from `34×39×30` to `1×1×1` and both suites run:

```
gate6-pinch-select   FAILED — Timed out waiting for onTriggerStart for "Body" after 5000ms
gate3-short-pinch-select  PASSED
```

The synthetic test is blind to a collider that no longer works. That is the
whole reason gate 6 exists.

### Why the pinch is driven from inside the Lens

The obvious design — arm the state, fire `PreviewInteractTool` from the agent,
assert in a second run — does not work, and the reason is worth knowing before
anyone tries it again:

**The LEAF plugin resets the Lens before every scenario run.** So a scenario
cannot observe anything a previous run set up, and cannot observe a gesture
injected between two runs; the reset wipes the armed story, the recorded
baseline and the gesture's effect together.

The scenarios therefore use `AiHandInteractor` directly — the same class
`PreviewInteractTool` drives remotely. It puppets the hand rig and feeds SIK's
real `PinchDetector`, so the event stream is identical, and setup, gesture and
assertion all stay inside one run. That is also what makes them deterministic:
the story is put on a named beat by command (`gestureHarnessJumpTo`), never by
waiting on a clock, because preview here runs at 0.1–15 fps.

### Two findings

**1. The moving chaser CAN be acquired — the recorded limitation did not
reproduce.** `prompts.md` records that a synthetic hold "could not reacquire the
moving target". A short pinch on the moving chaser succeeded on four
consecutive runs, with the creature travelling 4.3–5.2 cm during the gesture.
The scenario fails if travel is under 2 cm, so a pass on a creature that had
already settled cannot be mistaken for success.

Still open: the original note was about a **hold**, not a short pinch. Holding a
moving creature through to completion is not covered by these five scenarios.

**2. Deselect-on-miss is not implemented, and this is a product decision.** A
pinch into empty space currently leaves the selection panel open.
`CreatureInteractionState.pressStart` is reachable only from a creature's own
`Interactable` and the scripted demo beats — there is no global background
handler, so a miss never reaches the state machine at all.

`gate6-pinch-miss` asserts the half that is a real invariant (a miss writes
nothing and must not land on a neighbouring creature — which is a genuine test
of collider size) and *reports* the selection behaviour rather than asserting
it, because whether the panel should close when you pinch away is a design
choice nobody has made yet.
