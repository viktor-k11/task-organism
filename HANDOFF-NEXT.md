# Handoff — Task Organism

For whoever takes this project over. Written to be read without any prior
conversation.

**What it is:** a spatial task manager for SPECS. Each unfinished task is a small
creature living ~2.4 m in front of you. Ignored tasks grow restless. The single
most urgent one walks toward you. Completing a task releases its creature.

**Two documents matter before you touch anything:**

| If you are | Read |
|---|---|
| changing how it looks | `HANDOFF-VISUAL.md` — first, in full |
| changing anything at all | this file, then run `node Tools/build-gate.js` |

---

## How to work here

```bash
node Tools/build-gate.js
```

One command, five stages, one exit code: TypeScript compile, shader-parameter
audit, all 20 LEAF scenarios, the 7-frame golden diff, and the release-frame
perf budget. Run it after any change. `README.md` explains the stages and how
the editor-driven half is captured; `--offline` runs the two stages that need no
editor.

New clone? See `## Getting started` in `README.md`. Short version: **a fresh
clone does not compile until Lens Studio has opened the project once** — the
Lens API declarations live in the gitignored `Cache/`.

---

## Honest state

### Verified

- **The core loop.** Create → creatures live in a habitat → urgency rises → the
  single most urgent approaches → pinch to select → pinch-and-hold to complete →
  release. Covered by 20 LEAF scenarios.
- **The domain invariants.** At most one chaser ever; chaser selection requires
  an urgency threshold, so three fresh tasks produce zero chasers; resolve is
  idempotent; storage is written before the release effect plays; behaviour
  state is computed from data + time and never persisted.
- **The real input path.** The six `gate6-*` scenarios drive an actual pinch that
  SIK resolves against the real collider — not `pressStart()` calls. Proven to
  catch what the older tests cannot: with the creature collider shrunk to
  1×1×1, `gate6-pinch-select` fails while `gate3-short-pinch-select` still
  passes.
- **Deselect-on-miss.** Playbook v3 §3.2 ("tapping elsewhere deselects"), built
  and asserted.
- **Release-frame cost.** Pooling took it from 551 ms to 224 ms at six
  creatures. The particle pool is prewarmed at startup; `reset()` deliberately
  does not clear it.
- **The urgency halo runs.** Driven every frame from `updateColorTint`, readback
  confirmed at 1.0 in a normal autoplay run. (It was suspected dead at one point
  — see Traps.)

### Provisional

- **The release-frame perf budget (300 ms)** is derived from the Perfetto figure
  plus headroom, *not* from `PerfGateProbe`, which has never been run against a
  responsive editor. Record the observed value and tighten it.
- **`gate6-moving-chaser-hold` is red.** A moving creature cannot currently be
  held to completion by the test harness — but the blocker is the harness, not
  the product: `AiHandInteractor.pinchInteractable` samples the target position
  once, and a chaser at 0.5 m/s covers ~25 cm during the ~0.5 s a pinch takes,
  against a 17 cm collider half-width. Left red on purpose rather than weakened.
  Whether a real hand (which tracks) can do it is **unknown**.
- **Everything is Preview-only.** No device has ever run this. Every performance
  number is desktop Preview, where ~80% of each frame is webcam tracking.

### Parked

- **`Assets/Scripts/Debug/TaskUnderstandingProbe.ts`** — an AI experiment using
  RemoteServiceGateway. Untracked, so it is not in the repo. It needs the
  RemoteServiceGateway package (gitignored, install from the Asset Library).
- **The RemoteServiceGatewayExamples prefab** used to reappear in the scene on
  every editor save, producing a mystifying 2744-line diff. It has been removed
  and a save is now a verified no-op. If a large unexplained scene diff appears
  again, this is the first thing to check.

---

## Open list, in priority order

### 1. Slots 1–3 are not unified with `CreatureTemplate`

A creature-wide art change currently takes **four edits**: `MovementRoot_1`,
`_2`, `_3` and `CreatureTemplate`. Slots 1–3 are authored in the scene; slots
4–6 are cloned from the template at runtime
(`TaskOrganismController.SLOT_NAMES` / `CREATURE_TEMPLATE_NAME`).

This is the biggest structural cleanup available and the one most likely to
cause a silent inconsistency — someone edits three of four places and the sixth
creature quietly differs. Highest priority because it makes every other visual
task cheaper.

### 2. The golden set is stale

`docs/golden/` was captured on 14 Aug; **12 source files are newer**. The gate
will mark stage 3 stale or failing until the seven frames are recaptured. Do
that before trusting any visual comparison. `node Tools/build-gate.js --plan`
prints the capture procedure.

### 3. The dissolve shader is written but inert

`PetBody.graphShader` contains a complete dissolve/spawn implementation:
object-space height sweep normalised to fractions of each mesh's own bounds,
procedural GLSL noise, an emissive edge band, and one direction flag serving
both release and spawn. It is **verified safe** — the whole effect sits behind
`if (a > 0.0)`, so with the parameter at 0 not one line executes and the render
is bit-identical to before.

It does not run, because `dissolveHeightCm` has not become a material property.
Startup logs `[DissolveParams] *** NOT LIVE ***`. See Traps below, and the
"shader parameter exposure" cycle in `prompts.md` for the full investigation.

Still to build once it is live: driving it from `ReleaseEffect` (wired but
unproven), particles emitted from the moving front, the spawn beat, the
0/25/50/75/100 capture matrix, and a release-frame perf re-measurement to
confirm `discard` did not give back the 551→224 ms win.

### Already fixed — do not re-open

Two items that appear in older notes are **done**, both in commit `2882b51`:

- **The two inert Art Direction sliders.** All 31 ART fields were audited;
  those two were the only inert ones and all now read `ART`.
- **`CHASE_SIDE_OFFSET` at 0/0.** Restored to 8–12° per `CLAUDE.md` and verified
  by measurement, not by eye: the settled chaser sits 114.3 cm from the camera
  at 10.09° off the view axis.

---

## What remains for submission

None of this is started. It is not a small list.

- **No Lens icon.** `/specs-publish` generates one; nothing exists yet.
- **`/specs-publish` has never been run.** No preflight, no content rating, no
  project signing key set up for release, no packaging, no upload, no review
  submission.
- **No demo video.** The recording plan exists (`prompts.md`); the takes do not.
  Note the constraint: SPECS is an additive display, so **always shoot against a
  dark background** — a bright backdrop washes the creatures out, and there is
  no material or mesh fix for that.
- **No eligibility checklist** against the hackathon rules.
- **The viewer-facing gates were judged by the developer.** Several acceptance
  criteria were written as "does a viewer read this as X" and were then answered
  by the person who built it. They have never been put in front of an
  independent viewer. Treat those as unvalidated, not as passed.

---

## Traps this project has already paid for

Each of these cost at least one working cycle.

**An unexposed shader parameter and a no-op are pixel identical.** The effects
are gated so 0 does nothing; an unexposed parameter also reads 0. So an intact
creature means *either* "the effect is off" *or* "the parameter never reached
the material", and **no capture can tell them apart**. Two wrong conclusions came
from reading a render. Always read the `[DissolveParams]` line in the log
**before** looking at the picture.

**Never rename an exposed shader parameter.** Renaming loses the exposure and
renaming back does not restore it. This is why `dissolveHeightCm` is a misnomer —
it carries object units, not centimetres — and is staying that way. Likewise, do
not add a parameter you can avoid: one that does not exist cannot fail to be
exposed.

**The Preview panel's own refresh does not reset the Lens.** Use
`RunAndCollectLogsTool` with `mode: refresh`. Refresh the panel instead and you
capture the frozen ending of the previous run, which looks plausible and is
wrong.

**The goldens are tied to one machine, one Preview environment and one panel
size.** They are not portable. If you recapture on a different setup, the whole
set moves and the diff is meaningless until you re-baseline deliberately.

**Editing `unlit.graphShader` rendered every creature black, silently, with no
compile error.** Root cause never found. `PetBody.graphShader` exists so that
shader work happens in our own file. Do not touch `unlit.graphShader`.

**`lensifyts` exits 0 even when compilation fails.** The build gate parses
diagnostics out of stdout instead of trusting the exit code. If you write
tooling around the compiler, do the same.

**The LEAF plugin resets the Lens before every scenario run.** So a scenario
cannot observe state set up by a previous run, and cannot observe a gesture
injected between two runs. That is why the gate6 scenarios drive the pinch from
inside the Lens via `AiHandInteractor` rather than via MCP.

**Preview frame rate swings from 0.1 to 17 fps on a loaded machine.** The gate6
scenarios need roughly >5 fps: `AiHandInteractor` waits 5000 ms of wall clock
but a pinch costs a fixed number of *frames*. If a gesture scenario fails on a
timeout, check the `[Capacity] fps=` line before suspecting the code.

---

## Before you hand the folder on

Two secrets are gitignored and have never been committed, but they **travel with
a folder copy**. Delete both before zipping or sharing the directory:

- `spk_debug_key.pem` — the project signing key
- `.mcp.json` — contains a live bearer token for the Lens Studio MCP endpoint
