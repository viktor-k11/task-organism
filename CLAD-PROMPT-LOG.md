# CLAD prompt log — Task Organism

*A spatial task manager for SPECS where unfinished tasks are living creatures.
Built with Claude Code + the CLAD toolkit, Lens Studio 5.23, Preview-only.*

---

## 1. One-page overview

**Task Organism** is a working SPECS Lens: up to six tasks live as procedurally
animated creatures in a habitat in front of the user, urgency is derived from
data and time rather than stored, exactly one creature may approach the user,
and pinch-and-hold completes a task and releases its creature. It was built in
**seven days (2026-08-10 → 2026-08-16)** across **9 agent sessions** (6 Claude
Code + 3 Codex, sequential, never simultaneous, on the same Lens Studio instance
over the same `lens-studio` MCP server) from **99 instructions**, producing **52
commits**, **44 TypeScript behaviour scripts (~9,200 lines)**, **20 LEAF
scenarios (~1,300 lines)**, **7 dependency-free Node tools**, **6 creature
species** (5 generated with SPECS text-to-3D, 1 third-party CC-BY), **6
generated sound cues**, and **one custom code-node shader**.

**CLAD carried the construction; the human carried the specification and every
acceptance decision.** The shipped code, tests, scene wiring, meshes, audio,
shaders, tooling and documentation were authored by agents through CLAD skills
and the Lens Studio MCP, driven by the instructions in §2 and the full appendix.
The human wrote the frozen spec *before* the build (`CLAUDE.md` invariants, plan
v3, playbook v3 — the very first setup instruction, written in Russian, orders
`CLAUDE.md` to be copied into the project root by hand before the agent starts,
because "the agent must not invent it"), operated Lens Studio itself, and judged every
visual result: **no render, recording or generated mesh entered the build
because an agent said it was fine.** Two generated species were rejected on
sight, a "grounded" claim was overturned by looking at the captures, and the two
scenarios that are currently red are red on purpose because they encode a
product question only a human hand in Preview can answer.

| | |
|---|---|
| CLAD skills used | `lens-studio-router`, `specs-project-init`, `specs-experience-builder`, `build-mesh` (SPECS text-to-3D), `build-sfx`, `shader-graph`, `specs-capture-perf-trace`, `perfetto-trace-analysis`, `verify-preview`, LEAF install / write / run |
| Agents | `ls-clad:specs-experience-builder` ×2, read-only `Explore` surveys ×2, `Plan` ×1 (8 subagent transcripts recorded in the session store) |
| MCP tools carrying the work | `RunAndCollectLogsTool` (60+), `run_leaf_scenario` (80+), `ExecuteEditorCode` (40+), `CaptureRuntimeViewTool` (40+), `CapturePanelScreenshotTool` (30+), `RecompileTypeScriptTool` (30+), `QueryRuntimeSceneTool` (25+), `scene-graphql`, `VirtualScene` |
| Declined with reasons | `MergeMeshesTool`, `SimplifyMeshTool`, `specs-lens-perf-attribution`, FAST3D, texture and music tools — see the "available and not used" table in [`prompts.md`](prompts.md) |

**Where to look:** this file is the process. [`prompts.md`](prompts.md) is the
full engineering log (every measurement, every wrong turn, ~1,560 lines).
[`docs/CLAD-RAW-TRANSCRIPT.md`](docs/CLAD-RAW-TRANSCRIPT.md) is all 99
instructions verbatim.

---

## 2. Key prompts by phase

Ten instructions where one prompt produced a large, working, verified piece of
the build. Quoted from the transcript; long prompts are excerpted, marked `…`,
and are complete in [`docs/CLAD-RAW-TRANSCRIPT.md`](docs/CLAD-RAW-TRANSCRIPT.md).

### 2.1 Scaffolding, with a hard boundary — 08-10

> "Set up the project scaffolding for a CLAD hackathon build. Do all of this in
> one pass … 1. Validate the project. Run `/specs-project-init`. Fix every issue
> it reports. If something can't be fixed automatically, list it for me
> explicitly rather than silently skipping it. …
> **Boundaries — important: Do not create any scene objects, scripts,
> components, or gameplay logic.** … If you think something in the product needs
> building, stop and ask me instead."

**CLAD returned:** `/specs-project-init` validation of the SPECS project, a Lens
Studio-aware `.gitignore`, the `docs/` and `clips/` trees, the empty
`prompts.md` process log, an eligibility checklist, a README stub, and commit
`116be35`. Nothing from the product design was built — the boundary held.

### 2.2 The emotional core, plan first — 08-10

> "Build the emotional core first, no task logic yet. One procedural blob
> creature (sphere + vertex displacement, soft organic look) with a clearly
> readable FRONT: two simple eyes so orientation is visible. Alive: breathing
> pulse ~3% scale, slow wander within 1.5m habitat, gentle squash&stretch on
> direction change, occasional glance at the camera (orient + tiny hop) that
> reads without text. Chase mode: target 1.1-1.3m from camera, 8-12 degree side
> offset, max 0.5 m/s, capped acceleration, smooth arrival with dead zone, stops
> at 1m, hesitant cat-like approach. Release: one-shot presentation event —
> brighten, ~30 soft particles, float up and fade over 1.5s, placeholder sound.
> Must be idempotent. Direct transform control, unlit materials, no physics
> engine. **Plan this first: show me the file structure and approach before
> building.**"

**CLAD returned:** a plan (saved verbatim as `plan-day1-hero.md`), then
`0a353d2` — `BlobMeshBuilder` lathe geometry, `CreatureMovement`,
`CreatureBehavior` with the chase state machine, `ReleaseEffect` with an
idempotency guard, all constants in `CreatureConfig`. Verified in Preview by
sampling live transforms at two timestamps (world position moved, body scale
0.992 → 0.983 — wander plus breathing) and by calling `release()` twice in one
tick: exactly one `[ReleaseEffect] play` per Lens reset.

The follow-up shows the shape of most instructions in this project — three
targeted amendments before a line was written:

> "1. Per-vertex wobble: keep it, but gate it behind `WOBBLE_ENABLED` in the
> config and make the per-frame `updateMesh` call skippable. This is the main
> perf risk for 6 simultaneous creatures later — I need to be able to turn it
> off in one line without touching behavior code. 2. Skip build-sfx today …
> 3. Skip the LEAF scenario today … Just make sure the public API
> (requestChase / endChase / release) is stable enough to be tested later
> without changing signatures."

### 2.3 The data layer — the spec was the prompt — 08-11

The instruction that commissioned `TaskRecord`, storage, `Clock`, `StateEngine`
and `AttentionArbiter` was one sentence:

> "After verification and commit, continue to the next frozen-plan step: **the
> data layer**."

It worked because the contract had been written by hand a day earlier and lived
in `CLAUDE.md`, which every session reads first — the data model, plus the
non-negotiable invariants: behaviour state is *computed*, never persisted; at
most one chaser; three fresh tasks must produce zero chasers; resolve is
idempotent and storage is written *before* the release effect; time is read only
through the `Clock` interface; the storage payload carries a `schemaVersion` and
a parse failure degrades to safe-empty.

**CLAD returned:** `TaskRecord`, `Clock`/`RealClock`/`DemoClock`,
schema-versioned persistent and in-memory storage adapters, a six-task
repository with copy-on-read boundaries and duplicate/cap rejection,
`StateEngine.deriveState`, `AttentionArbiter.selectChaser`, plus the LEAF
package installed (2.0.2) and a `task-organism-data-layer` scenario covering
restore / add / snooze / resolve / restart / corrupt storage. Commit `0ed92b2`.

### 2.4 Gate 2 — evidence, item by item — 08-11

> "The data-layer test passes. Now verify Gate 2: Product Truth before starting
> interaction work. Run and report **separate evidence** for: 1. Three fresh
> tasks → zero chasers. 2. Advance one task beyond `CHASE_THRESHOLD` → exactly
> one chaser. 3. Snooze that task → zero chasers. 4. Advance beyond snooze
> expiration → exactly one chaser. 5. Persistence restore after a Lens restart:
> same task id and text. 6. Elapsed-time transition after restore without
> waiting. 7. Resolve called twice → one repository update and one release
> event. 8. Confirm that the state engine never calls `Date.now()` directly."

**CLAD returned:** five LEAF scenarios, each run as its own Preview run — and
therefore its own Lens reset — so that "persistence across restart" meant an
actual restart (`gate2-5-persistence-seed` then `gate2-5-persistence-restore`,
restoring `id=persist-id` exactly). Item 8 was answered statically: `rg` found
no `Date.now()` anywhere under `Assets/Scripts/State`; the only call in the
project is inside `RealClock.nowMs()`. Commit `7989312`.

### 2.5 Gate 3 — the whole interaction loop in one instruction — 08-11

> "Proceed to Gate 3: Concept Comprehension. Build the complete input and
> interaction loop without expanding scope. Implement in this order: 1.
> `TaskInputSource` …"

**CLAD returned:** `TaskInputSource` with a deterministic `DemoInput` and a
Specs `KeyboardInput` sharing one `TaskCreationService`; SIK short-pinch
selection; a UIKit task panel with bounded two-line text and a single `Later`
action; a 0.7 s hold-to-resolve with visible progress and free cancellation;
gesture-role freezing so one press can never both select and resolve; and six
`gate3-*` LEAF scenarios covering input parity, select, early cancel, completed
hold, gesture separation and snooze. Commit `b6a9e1b`.

### 2.6 Behavioural legibility — the prompt that found a dead feature — 08-11

> "I looked at it myself: I cannot tell the three states apart. Three ovals with
> eyes. Translation distance is the weakest possible signal at 1.3m — 1-2cm is
> invisible to a viewer. Amplify the states on channels that actually read,
> config-level: 1. GAZE … 2. BREATHING … 3. POSTURE … 4. COLOR … Make each of
> these clearly overdone at first — I would rather dial exaggeration down than
> fail to see it."

**CLAD returned:** the four channels, and — while wiring them — the discovery
that **`URGENT` had never been reachable in the built Lens.**
`StateEngine.deriveState` had returned `CALM | URGENT | CHASING` since the data
layer and LEAF exercised all three, but `TaskOrganismController.syncArbiter`
only ever called `requestChase()`/`endChase()`, and `CreatureBehavior` had no
urgent presentation state at all. A task past the threshold that was not the
single chaser rendered identically to a fresh one. **The three-state model was
real in the domain and invisible in the product, while the Gate 2 tests passed
the whole time — because they assert on the arbiter, not on presentation.**
Fixed by `setUrgent()` / `setUrgencyLevel01()` driven per slot from
`deriveState`; commit `65215c2`.

### 2.7 Five species, generated, with an acceptance test — 08-13

> "Generate five creature species with the CLAD 3D asset generation skill.
> **Quality is the priority, not speed** — generate one at a time, evaluate it
> against the acceptance test below, and iterate on it before moving to the
> next…"

**CLAD returned:** seven `build-mesh` (SPECS text-to-3D) jobs producing five
accepted species — cat, owl, baby elephant, rabbit, penguin — and two explicit
rejections. Cat attempt 1 was rejected because the eyes were painted texture,
not geometry; the phrasing that fixed it ("separate solid spheres that bulge
out") was then reused for every later species. The elephant needed a full
rewrite. **The side effect was larger than the feature: replacing bought and
borrowed models with generated ones retired the project's licensing question
outright** rather than documenting it — five of six species carry no
third-party rights at all.

### 2.8 Urgency as light, not paint — 08-14

> "Give urgency its own visual channel: light, not paint. Today urgency is
> communicated by blending red into the creature's base colour. That channel
> fights identity: at the first blend values a chasing yellow creature rendered
> identically to a calm amber one … Extend `PetBody.graphShader` (our own
> code-node shader — do NOT touch `unlit.graphShader`) with a separate emissive
> channel driven by the continuous urgency value already delivered by
> `setUrgencyLevel01()` … **Safety, from the failure already recorded in
> prompts.md: a previous graph edit produced silently black bodies with no
> compile error. Build this so that urgency = 0 is an exact mathematical no-op,
> verify that case first, and keep the blend-from-white property so a mesh
> lacking COLOR_0 degrades to unshaded rather than invisible.**"

**CLAD returned:** a rim term and a sub-1.5 Hz brightness pulse in the project's
own code-node shader, identity hue preserved at every urgency level, verified at
urgency 0 / 0.5 / 1.0 on three palette colours against dark and bright
backdrops. The instruction is worth reading twice: **a failure recorded earlier
in the log was handed back to the agent as a design constraint**, so the
replacement degrades to "unshaded" where the previous attempt degraded to
"invisible".

### 2.9 A verification harness for a person who is not the author — 08-14

> "Build a visual regression harness with golden images. Every visual change in
> this project has been verified by hand. From Friday a different person will be
> changing the visuals, and nothing would catch it if they silently broke
> grounding, facing, label legibility or the release sequence. … **Two traps
> already recorded in prompts.md, do not fall into them again:**
> `PreviewPanelTool.screenshot` reports success but does not create missing
> directories — an entire capture batch once went nowhere. And
> `PreviewPanelTool` refresh does NOT reset the Lens; only
> `RunAndCollectLogsTool` with `mode: refresh` does, so without it you capture
> the frozen ending of the previous run."

**CLAD returned:** seven deterministic golden frames, a dependency-free differ
(`sips` → BMP → ~40 lines of parsing, because "a harness that opens with
`npm install` does not get run"), non-visual assertions at every frame — and the
freeze bug in §3.2, which is why this is the strongest cycle in the project.

### 2.10 One command that proves the build is healthy — 08-15

> "Build one command that proves the build is healthy. Compose what already
> exists into a single runnable script that a person who did not write this
> project can use: 1. TypeScript compile 2. All 13 LEAF scenarios 3.
> Golden-image diff across all seven frames 4. A short perf capture at 6
> creatures, checked against a recorded threshold … **Verify the script the way
> you verified the golden differ: prove it fails. Break one thing deliberately
> at each stage, confirm the report catches it and names it, then restore. A
> verification script nobody has seen fail is not a verification script.**"

**CLAD returned:** `Tools/build-gate.js` — five stages, one verdict, one exit
code, no dependencies, each stage broken on purpose and confirmed to fail loudly
before being restored. Detailed in §4. Commit `5c1561c`.

---

## 3. Case study: the closed loop in action

CLAD is sold as a loop that repeats design → build → test until the tests pass.
These two cycles are that loop with the failures left in. Neither bug was hidden;
both are in the repository's history with the wrong hypotheses attached.

### 3.1 The floating regression — three rounds, three different causes

The creatures kept ending up in the air. It came back twice after being called
fixed, and each time the real cause was somewhere new.

**Round 1 — after the model swap (08-11).** The prompt refused to accept a fix
before a measurement:

> "Now the floating regression. The creatures float high in the sky in Preview
> after the model swap. **Check in this order and report actual runtime values
> before changing anything:** 1. The Y-recenter in `CreaturePetVisual` — the new
> per-species scale factors (16.6x dog, 40.2x cat) may be applied in the wrong
> order relative to the recenter, multiplying the offset. 2. `HabitatFloor` Y
> position versus the creature foot line. 3. Whether habitat Y math is applied
> on top of an already-offset mesh. **Report the creature Y, the foot line Y,
> and the floor Y as they actually are at runtime.**"

The values came back, a correction landed with the visual swap (`65215c2`), and
the creatures stood on the floor — in that Preview environment. That is the whole
problem with the first round: it was verified where it was tuned.

**Round 2 — floating again after switching Preview environment (08-12).**

> "The creatures float again after I switched the Preview environment. This
> suggests the ground level is a hardcoded Y constant rather than derived from
> the actual scene. 1. Report where the floor Y comes from right now — constant,
> camera height, or surface detection. 2. Make grounding relative to a single
> ground reference that adapts … 3. `HabitatFloor` and the creatures' foot line
> must always agree — if the floor moves, the creatures move with it. **Test by
> switching Preview environments: creatures stay planted in both.**"

*Hypothesis:* two independently-tuned numbers. Confirmed:
`CreatureBehavior` placed `MovementRoot` at `camY + offset` and treated it as the
mesh *centre*, while `HabitatFloor` separately computed
`camY + offset − READYMADE_PET_HALF_HEIGHT_CM` — a flat correction that ignored
the creature's live presentation scale (0.68 calm / 0.95 chase / up to 1.25
growth). They agreed at exactly one camera height.

*Fix:* one shared `GROUND_Y_OFFSET_CM` consumed unmodified by both, plus
per-frame pivot compensation on `VisualRoot` so the rendered feet land on that
line at any scale.

*First answer was wrong, and the log says so.* The constant was hand-retuned to
`−20`, and the agent's summary called the result "grounded together at a
consistent, plausible surface line". The captures showed them hovering in a
second environment. They were consistent *with each other*, which is not the same
as planted. Re-derived instead from a property of the platform —
`GROUND_Y_OFFSET_CM = −EYE_HEIGHT_CM (150)`, because every Interactive Preview
room is authored around a camera at standing height.

*A second defect fell out of the runtime polling:* creatures descended from spawn
to the floor at 7 cm/s — `MovementRoot_1` Y read −29 → −85 → −137 across
successive `QueryRuntimeSceneTool` samples. `resetToIdle()` / `setHabitatHome()`
now snap; all three then read exactly −150 on the first frame.

**Round 3 — "they stand on the sofa back, not the floor" (08-12).** The constant
was never the problem this time. `recomputeHabitatOrigin` used the camera's full
3D forward vector as the depth axis, so head pitch scaled habitat distance by
`cos(pitch)`: at the ~40° downward angle needed to look at floor-level creatures,
240 cm collapsed to 184 cm — which landed exactly on the sofa. **The more you
looked down at them, the further they climbed onto the furniture.** Fixed by
flattening the forward vector to the horizontal plane in *both*
`recomputeHabitatOrigin` and `buildHabitatFloor` — the same projection in both,
or the floor disc and the creatures land at different depths.
`GROUND_Y_OFFSET_CM` was not touched.

*Verified:* captures at habitat distance show all three creatures on the carpet
past the sofa with contact shadows on the floor, in both Preview environments.

**What the loop actually bought:** three plausible hypotheses, only one true each
round, and no way to tell them apart except runtime values and captures. The
honest limit is recorded too — the Lens camera reports world position `(0,0,0)`
in every Interactive environment and those environments are backdrop, not
scene-graph objects, so there is no queryable floor. Real surface detection needs
`WorldQueryModule` against a device world mesh, which is out of scope under the
preview-only rule. The fix is a *convention* both consumers share, not a
detection, and the log says that in those words.

### 3.2 The freeze bug — found by a harness built for something else, closed by LEAF

**The bug.** While baselining the golden images, the post-release frame never
logged READY. The cause was not the harness. `TaskOrganismController` — the
composition root that owns the repository, state engine, arbiter, interaction
state and demo sequence — was a ScriptComponent on `MovementRoot_1`. And
`CreatureBehavior.release()` ends with:

```ts
this.sceneObject.enabled = false;
```

**Completing the first task disabled the object hosting the controller.** Arbiter
sync, demo beats, gesture updates and capacity logging all stopped in the same
frame. Not only in the demo: in the product, complete your first task and the app
quietly stops working.

**Why nothing had caught it.** Three things conspired: a stopped log and a
finished log look identical (the scripted story *ends* at release, so every
previous run's log stopping there looked correct); **all twelve LEAF scenarios
passed the entire time**, because they exercise the domain as plain TypeScript
and never touch the scene object graph's lifetime; and no screenshot could show
it, because the bug is the *absence of subsequent frames*, not the content of any
frame.

**The diagnostic that found it** was not a debugging prompt at all — it was the
harness's non-visual assertions, demanded in the harness prompt (§2.9): every
creature's feet on `GROUND_Y_OFFSET_CM`, at most one chaser, expected open count,
at every frame. Two lesser bugs fell out of the same assertions first, both of
which produced entirely plausible-looking images: a 50%-hold frame that ran to
completion (`open=5` where 6 was expected — the picture looked like a release),
and, after that was fixed, release frames that released nothing (`open=6` where 5
was expected). Both would have been accepted as goldens by eye.

**The fix.** Move the controller to its own `TaskOrganism (controller)` scene
object. Evidence, quoted from the log:

> **`[Capacity]` entries now continue past `beat=RELEASED`, where they
> previously stopped dead at it.**

**Closing the gap the tests left** — the next instruction, verbatim:

> "Lock the freeze bug so it cannot come back. Add an assertion or a LEAF
> scenario that specifically covers controller survival: complete a task, then
> verify the composition root is still alive and the arbiter still runs — the
> simplest proof is that a second task can be selected and resolved after the
> first release. **All 12 existing scenarios passed while this bug was live,
> because they exercise the domain and not the object graph's lifetime. Close
> that gap explicitly.**"

**CLAD returned `gate4-controller-survives-release`** — the only scenario in the
suite that inspects the *scene object graph* rather than the domain, in two
halves. Structural: exactly one object hosts the controller, it is not a creature
slot, is not a descendant of one, and is enabled — and finding zero objects fails
rather than vacuously passing. Behavioural: after one task is released the
arbiter promotes a *different* second chaser and it resolves too.

**Verified by reintroducing the bug.** Reparenting the controller under
`MovementRoot_1` makes the scenario fail; moving it back makes it pass. *A test
never seen failing is not a test.*

**Result: LEAF 13/13 green, with the regression provably locked.** Commits
`ab4442f` (harness + the bug it found) and `e3a40a1` (the lock).

**And the product got better because of it.** Only once the controller survived a
release could the demo show a **second completion** — one completion reads as a
scene, two read as a system. The first attempt at that was also wrong and also
measured: reusing the select-read constant gave the second creature 1.24 s of
travel, which read as a teleport; restructured with an explicit post-release gap,
the second approach now gets 2.97 s and the whole story runs 24.76 s.

---

## 4. Gates and LEAF verification

Three layers of gate, each answering a different question.

### 4.1 Product gates — human-facing, and honestly labelled

From the frozen playbook: **Gate 1 Character Vitality**, **Gate 2 Product
Truth**, **Gate 3 Concept Comprehension**, **Gate 4 Emotional Payoff**, **Gate 5
Submission Safety**. Every audit in this project classified each gate as
`PASSED` / `TECHNICAL ONLY` / `PARTIAL` / `NOT STARTED`, with automated
verification explicitly distinguished from human validation — and the labels were
not rounded up. The Codex → Claude handoff document recorded Gate 3 as
"technically integrated but not human-validated" and instructed the next session
not to claim comprehension evidence from a recording that had failed the
readability check. **The handoff propagated a negative result rather than a
flattering one.**

### 4.2 LEAF — 20 scenarios, run in the Preview

Registered in `Assets/Tests/LeafIndex.ts`, executed through the Lens Studio MCP
(`run_leaf_scenario`, 80+ invocations over the week):

| Family | Scenarios | What it locks |
|---|---|---|
| data layer | `task-organism-data-layer` | restore, add, snooze, resolve, restart, corrupt-storage recovery |
| gate2 (5) | `gate2-1-4-chaser-lifecycle`, `gate2-5-persistence-seed`, `gate2-5-persistence-restore`, `gate2-6-8-elapsed-clock`, `gate2-7-resolve-idempotency` | zero chasers from three fresh tasks; exactly one after ageing; snooze suppression and expiry; restore across a real Lens restart; elapsed-time transition with no waiting; resolve idempotency |
| gate3 (6) | `gate3-input-parity`, `gate3-short-pinch-select`, `gate3-early-hold-cancel`, `gate3-completed-hold`, `gate3-no-gesture-conflict`, `gate3-later-snooze` | the interaction contract at service level |
| gate4 (1) | `gate4-controller-survives-release` | the composition root survives a release — §3.2 |
| gate5 (1) | `gate5-snooze-runtime-path` | snooze through the runtime path, not the service |
| gate6 (6) | `gate6-pinch-select`, `gate6-pinch-hold-resolve`, `gate6-pinch-early-release`, `gate6-pinch-miss`, `gate6-moving-chaser`, `gate6-moving-chaser-hold` | a **real synthetic pinch** on a **real creature**, driving the actual input path |

The gate6 family exists because of this instruction:

> "Close the last verification gap: **test the gesture, not the code behind it.**
> Every interaction scenario today calls `pressStart`/`pressEnd` at the service
> level. Nothing verifies that a real pinch on a real creature reaches the
> interactable — and that layer has already produced defects found only by hand:
> buttons that kept a default 20x20x20 collider so SIK could not resolve which
> one was meant, and a BackPlate whose own collider obstructed the rows above it.
> … **If scenario 5 still cannot reacquire a moving creature, report that as a
> finding rather than working around it** — it is a real product property, not a
> test problem, and it tells us whether a user can actually grab an approaching
> creature."

**It could not, and the two scenarios are red on purpose.** The synthetic
`AiHandInteractor` samples its aim point once; a chaser at the 0.5 m/s cap moves
~25 cm during a ~0.5 s pinch delivery, against a 17 cm collider half-width. A
real hand tracks; the instrument does not. They are documented in commit
`be9d406` and in `HANDOFF.md` with an explicit instruction **not** to green them
by pausing the creature, because they assert a product question that needs a
human hand in Preview. Last full run: **18/20, with those two the only reds.**

### 4.3 The build gate — one command, five stages

```bash
node Tools/build-gate.js
```

```
  ok   1. TypeScript compile    PASS     0 errors
  ok   2. LEAF scenarios        PASS     20/20 ran
  ok   3. Golden images         PASS     7/7 frames within 1%
  ok   4. Release-frame perf    PASS     worst release frame 223.7ms vs budget 300.0ms
```

That report is a captured run, committed with the gate. The final session
(2026-08-16) recorded **18/20** on the LEAF stage — the two `gate6-moving-chaser*`
scenarios of §4.2 — and `HANDOFF.md` says so in those words rather than
re-baselining them away.

Plus a fifth, static stage: **shader-parameter audit** — every parameter a shader
exposes must have a TypeScript writer. Exit code 0 only when every stage passes,
`1` on failure, `2` on a broken environment; on failure it names the artifact to
open. It needs nothing installed: node stdlib, macOS `sips`, and Lens Studio's
own bundled compiler.

Properties that make it more than decoration:

- **Stale evidence fails.** Every captured artifact is checked against the newest
  edit in `Assets/Scripts`; anything older is `STALE` and fails. *A gate that can
  go green on last week's screenshots is worse than no gate, because it looks
  like coverage.*
- **Capture and judge are split**, because two stages need a running Lens and the
  editor is reachable only through MCP inside an agent session. Claude captures
  (`--plan` prints the exact sequence, including `RunAndCollectLogsTool
  mode: refresh` between stages and retry-once on an MCP timeout with the real
  invocation count recorded); anyone can judge, unattended.
- **`--offline` reports `PARTIAL`, never `PASS`** — a partial verdict is not a
  healthy build.
- **Every checker was proven to fail before being trusted.** The differ: identical
  input 0.00%, substituted frame 7.36%, deleted frame `MISSING CAPTURE`. The gate:
  one thing broken deliberately at each stage. The regression lock: the bug
  reintroduced.

### 4.4 The gate that came from a silent failure

Three shader failures in this project were silent — bodies that rendered black
with no compile error, dropped parameters, and an urgency halo that had been
counted as delivered while never running in a normal build, because nothing
wrote its parameters and the whole channel was gated on `urgency > 0`. The
instruction that closed it added a *class* of check rather than a fix:

> "Add a check for this class of failure to the build gate: a shader parameter
> that no TypeScript writes is almost certainly inert, and the gate can catch
> that statically. This is the third silent failure in this file format … **A
> static check is cheaper than a fourth.**"

and then, when captures still could not distinguish "off" from "not yet live":

> "**Make the readback a precondition, not a diagnostic.** Have every run log the
> readback of `DissolveAmount`, `DissolveBaseY` and `DissolveHeightObj` at
> startup, per creature. If any reads 0 or undefined where a real value is
> expected, say so loudly in the log. Then no capture is ever interpreted without
> knowing whether the parameters were live when it was taken."

Both landed: a static writer audit in the gate, and a runtime readback that
refuses to let a capture be interpreted blind.

### 4.5 Performance, measured rather than claimed

The perf stage exists because a number in a checklist turned out to be wrong. An
in-app FPS counter had reported 13.9 fps at six creatures; it was measuring the
MCP-instrumented Preview harness, not the content. Ten Perfetto captures via
`/specs-capture-perf-trace` at 3 / 5 / 6 creatures put the real median at
**23–26 fps**, and attributed **63–70% of every frame to `Track`** — the
Preview's own desktop webcam tracking, which has nothing to do with creatures.
The whole creature system costs 6–12 ms of a 39–43 ms frame. **The optimization
loop then declined to optimize**, on the project's own rule that a change buying
under 10% is reverted — except one: release-frame construction, pooled at
startup, **551.3 ms → 223.7 ms (−59.4%)** with all 30 particles kept. That number
is now the gate's budget.

And the limit is stated in the log rather than glossed: every figure is desktop
Preview, where tracking dominates, so it is evidence about relative cost and
about a specific before/after — **not** a clearance for SPECS hardware, which
this project has no device to test on.

---

## 5. Raw transcript

**[`docs/CLAD-RAW-TRANSCRIPT.md`](docs/CLAD-RAW-TRANSCRIPT.md)** — all 99
instructions, verbatim, chronological, extracted programmatically from the
agents' own session stores (Claude Code and Codex), with only machine-generated
turns removed. It is not written to be read end to end; it is there so any claim
in this file can be checked against what was actually typed.

**[`prompts.md`](prompts.md)** — the engineering log written *during* the build:
every cycle with its tools, its measurements, its wrong turns and its evidence,
including the CLAD capability inventory (used / discarded / declined, with
reasons). ~1,560 lines.

**[`docs/evidence/`](docs/evidence/)** and **[`docs/golden/`](docs/golden/)** —
before/after captures for the visual findings, and the seven committed golden
frames the build gate diffs against.

---

## 6. Honest limits

What CLAD did **not** close, stated plainly so nothing here reads as a bigger
claim than it is.

- **Preview-only, no device.** `CLAUDE.md` forbids code that can only be verified
  on hardware. Every performance and visual number is desktop Preview.
- **Two LEAF scenarios are red** (`gate6-moving-chaser`,
  `gate6-moving-chaser-hold`) because the synthetic hand cannot track a moving
  target. They encode a real product question and are left red for a human to
  answer in Preview.
- **The dissolve/spawn shader is landed but not wired.** The GLSL is in
  `PetBody.graphShader` and verified inert; parameter exposure through the
  material import is a platform behaviour this project measured but could not
  make deterministic. Recorded as a platform finding, not as a feature.
- **One graph-shader root cause was never found** — hand-editing
  `unlit.graphShader` produced silently black bodies with no diagnostic. It was
  isolated, reverted, and routed around via a code-node shader. A workaround, and
  the log calls it one.
- **The additive display is a hard constraint, not a bug.** Rendered content adds
  light over passthrough; a fully opaque black object is invisible. This governs
  every colour decision and confines recording to dark backgrounds.
- **One third-party asset remains** — the CC-BY dog, attributed in
  `LICENSES.md`. The other five species are generated and carry no third-party
  rights.
- **Voice task creation is verified only to the session boundary** — V toggles an
  ASR session live in Preview; one real spoken utterance still needs a human and
  a microphone.
