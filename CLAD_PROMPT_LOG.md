# CLAD Prompt Log — Task Organism

**CLAD Summer Hackathon, Week 1: "Organize" (Aug 10–16, 2026) — submission document**

| | |
|---|---|
| Project | **Task Organism** — a spatial task manager for SPECS where tasks are living creatures |
| Author | Viktor Kulaha — Snapchat: **viktorkulaha** |
| Dates | 2026-08-10 → 2026-08-16 (7 days) |
| Tools | Lens Studio 5.23 (SPECS 27 target), Claude Code (+ 3 Codex sessions), `ls-clad` plugin, Lens Studio MCP server, LEAF test framework |
| Sessions | **10 agent sessions on 2 machines** (7 Claude Code + 3 Codex, sequential, same repo, handoffs via `HANDOFF.md`) |
| Repo | https://github.com/viktor-k11/task-organism |

*This file is the submission-facing summary. Everything it claims is backed by
[`prompts.md`](prompts.md) — the full engineering log (~1,700 lines): every
cycle of all ten sessions with its prompts, measurements and wrong turns,
ending with the final session's prompts verbatim and the reaction to each.
Before/after captures are in [`docs/evidence/`](docs/evidence/).*

## CLAD Usage at a Glance

Call counts are approximate, totalled across all ten sessions. **Every
individual invocation — what was asked, what came back, how it was verified —
is recorded case by case in [`prompts.md`](prompts.md).**

| Surface | What was used |
|---|---|
| **CLAD skills** | `lens-studio-router`, `specs-project-init`, `specs-experience-builder`, `build-mesh` (SPECS text-to-3D — 7 generation jobs, 5 accepted species), `build-sfx` + `build-music` (8 license-clean audio cues), `shader-graph` (custom code-node urgency shader), `specs-capture-perf-trace` + `perfetto-trace-analysis` (10 traces, every perf number), `verify-preview`, LEAF install / write / run |
| **Agents** | `ls-clad:specs-experience-builder` ×2, read-only `Explore` surveys ×2, `Plan` ×1 |
| **MCP: verify & run** | `run_leaf_scenario` 90+ (20 scenarios), `RunAndCollectLogsTool` 75+ (runtime log analysis after every change), `RecompileTypeScriptTool` 45+ |
| **MCP: see the result** | `CapturePanelScreenshotTool` 50+, `CaptureRuntimeViewTool` 45+ (isolated renders), `MovePreviewCamera` (aiming verification shots) |
| **MCP: query the truth** | `QueryRuntimeSceneTool` 35+ (live transforms, bounds, interactables — including the query that proved the owl rendered 21 m while every runtime AABB said 28 cm), `scene-graphql` |
| **MCP: build the scene & assets** | `ExecuteEditorCode` 40+, `VirtualScene`, `ConvertSvgToTexture` ×10 (window chrome, 6 species icons, sparkle motes), `FontSelector` |
| **MCP: drive the input** | `InjectPreviewGesture` 15+ (keys, taps, touch sequences), `PreviewInteractTool` (synthetic SIK pinches) |
| **Declined, with reasons on record** | `MergeMeshesTool`, `SimplifyMeshTool`, `specs-lens-perf-attribution`, FAST3D, texture/music library tools — the used/discarded/declined judgement for each is in the CLAD inventory at the top of [`prompts.md`](prompts.md) |

---

## 1. Project Summary

**Task Organism** turns a to-do list into a small ecosystem you share a room
with: each open task is a living, animated creature standing in a habitat in
front of you. Urgency is *derived from data and time* — never stored — and the
single most urgent task gently approaches you like a cat asking for attention;
pinch-and-hold "takes care of" a task and releases its creature with particles
and sound, and an end-of-day screen (TODAY.TXT) shows every creature you cared
for, with an optional 1-minute closing ritual. It addresses the Week 1
"Organize" theme by making task load *spatial and emotional*: what needs doing
is visible at a glance, what's urgent literally comes to you, and finishing
things is a moment of release rather than a checkbox.

---

## 2. How CLAD Was Used — Overview

**Every line of shipped TypeScript (44 behaviour scripts, ~9,600 lines), every
LEAF scenario (20), every shader, every generated asset and every verification
tool was authored by CLAD from prompts.** The human contribution was
specification and judgement: the frozen invariants in [`CLAUDE.md`](CLAUDE.md)
written *before* any code, art direction, choosing and downloading the six
animated models, and accepting or rejecting every visual result by eye. No
render or mesh entered the build because an agent said it was fine. Honest
share estimate: **~95% of artifacts CLAD-built, ~100% of decisions human-made.**

What CLAD built end-to-end, by layer:

- **Domain** — `TaskRecord`, `TaskRepository`, schema-versioned persistent
  storage with safe-empty recovery, `Clock`/`RealClock`/`DemoClock`,
  `StateEngine` (states computed, never stored), `AttentionArbiter` with the
  zero-chasers-when-fresh threshold. Unchanged since day 2.
- **Creatures** — first a procedural blob (`BlobMeshBuilder`, lathe geometry),
  then 5 species generated with SPECS text-to-3D, then (final day) **six
  animated, textured GLB models** integrated with runtime auto-scale
  normalization across 5 orders of magnitude of authored size
  (`CreaturePetVisual.normalizeSize`), animation-clip selection by name, and a
  **rest-still / move-animate** locomotion driver (creatures hold a frozen pose
  and play their walk/waddle clip only while actually translating).
- **Interaction** — SIK pinch-select and 0.7s hold-to-resolve with gesture-role
  freezing, task selection panel, snooze, idempotent release with pooled
  particles.
- **UI** — the whole retro-desktop system-message language: `RetroUi.ts` dialog
  builder (title bars, icon gallery rows, bold subheadlines, mono ".txt"
  bodies), onboarding flow, screen-space reminder HUD, TODAY.TXT end-of-day
  screen with per-species pixel icons, closing ritual with a twinkling
  star-field. Window chrome, 6 species icons and sparkle textures were authored
  as SVG *by CLAD* and rasterized through the MCP.
- **Verification** — 20 LEAF scenarios in 6 gate families, a golden-image
  regression harness with a dependency-free differ, `Tools/build-gate.js` (one
  command: compile → LEAF → goldens → perf budget → shader-parameter audit),
  every checker proven to fail before being trusted.
- **Performance & size** — Perfetto-measured release-frame fix (551 → 224 ms),
  final-day fps recovery 16 → 30 by gltf-transform decimation (elephant 19.2k →
  3.7k tris), and a **~15 MB packed-size cut** (audio 18.9 → 4.7 MB via 22 kHz
  mono, textures resized).

The full inventory of CLAD skills and MCP tools, with call counts, is the
**"CLAD Usage at a Glance"** table at the top of this file; every individual
invocation is recorded case by case in [`prompts.md`](prompts.md). Outside
MCP, CLAD also drove `gltf-transform` (mesh decimation preserving
skins/animations), `afconvert`, `sips`, and ad-hoc Python GLB introspection to
diagnose rigs.

---

## 3. Prompt Log (Chronological)

Sessions 1–9 (two machines, 99 instructions total) are summarized with their
highest-yield prompts, quoted verbatim; Session 10 — the final
design-and-menagerie session — is logged in detail here. The full
cycle-by-cycle account of all ten sessions, including Session 10's prompts
verbatim with the reaction to each, is [`prompts.md`](prompts.md).

### Phase A — Scaffolding with a hard boundary (08-10)

```
Set up the project scaffolding for a CLAD hackathon build. Do all of this in one
pass … Run /specs-project-init. Fix every issue it reports …
Boundaries — important: Do not create any scene objects, scripts, components,
or gameplay logic. … If you think something in the product needs building, stop
and ask me instead.
```
CLAD validated the SPECS project, built the repo hygiene (`.gitignore`, `docs/`,
`prompts.md` log, README) and **respected the boundary** — nothing of the
product was built. *Outcome: worked first try.*

### Phase B — The emotional core, plan first (08-10)

```
Build the emotional core first, no task logic yet.
One procedural blob creature (sphere + vertex displacement …) with a clearly
readable FRONT: two simple eyes … breathing pulse ~3% scale, slow wander within
1.5m habitat … Chase mode: target 1.1-1.3m from camera, 8-12 degree side offset,
max 0.5 m/s, capped acceleration … hesitant cat-like approach.
Release: one-shot presentation event … Must be idempotent.
Direct transform control, unlit materials, no physics engine.
Plan this first: show me the file structure and approach before building.
```
CLAD planned, then generated `BlobMeshBuilder`, `CreatureMovement`,
`CreatureBehavior` (chase state machine), `ReleaseEffect`, `CreatureConfig`.
Verified by sampling live transforms at two timestamps through
`QueryRuntimeSceneTool` (position moved while scale breathed) and calling
`release()` twice — one effect. *Outcome: worked; 3 follow-up amendments.*

### Phase C — The entire domain layer from a one-line prompt (08-11)

```
After verification and commit, continue to the next frozen-plan step: the data layer.
```
One sentence sufficed because the contract lived in `CLAUDE.md` (data model +
8 non-negotiable invariants, written by hand before any code). CLAD returned
the complete domain — repository, storage adapters, clocks, state engine,
arbiter — **still unchanged at submission**, plus the LEAF package installed
and the first scenario. *Outcome: worked first try; the highest-yield prompt of
the project.*

### Phase D — Tests before features: Gates 2–3 (08-11)

```
Now verify Gate 2: Product Truth … Run and report separate evidence for:
1. Three fresh tasks → zero chasers. 2. Advance one task beyond CHASE_THRESHOLD
→ exactly one chaser. 3. Snooze that task → zero chasers. … 7. Resolve called
twice → one repository update and one release event. 8. Confirm that the state
engine never calls Date.now() directly.
```
CLAD wrote 5 LEAF scenarios and — its own decomposition — split persistence
into *seed* and *restore* scenarios run as separate Lens resets, so "restore
across restart" meant a real restart. Item 8 answered statically (`rg`: one
`Date.now()` in the codebase, inside `RealClock`). The Gate 3 prompt then
produced the whole interaction loop + 6 more scenarios. *Outcome: worked.*

### Phase E — Legibility pass that found a dead feature (08-11)

```
I looked at it myself: I cannot tell the three states apart. Three ovals with
eyes. … Amplify the states on channels that actually read … Make each of these
clearly overdone at first — I would rather dial exaggeration down than fail to see it.
```
While wiring gaze/breathing/posture/color channels, CLAD discovered **URGENT
had never been reachable in the built Lens** — real in the domain, invisible in
the product, while all Gate 2 tests stayed green (they assert on the arbiter,
not presentation). *Outcome: needed the human's eye to trigger; CLAD found the
root cause.*

### Phase F — Generated species + urgency-as-light shader (08-13/14)

Five species generated with SPECS text-to-3D after an explicit acceptance test
per species; cat attempt 1 rejected (eyes were texture, not geometry — fatal in
an unlit pipeline), fixed by re-prompting *"two separate solid spheres that
BULGE OUT from the face, like buttons sewn onto a plush toy"* — phrasing then
reused for every species. The `PetBody.graphShader` urgency channel was
commissioned with **a previously logged failure handed back as a design
constraint**: *"a previous graph edit produced silently black bodies with no
compile error. Build this so that urgency = 0 is an exact mathematical no-op,
verify that case first."* *Outcome: 2 iterations on the cat; shader worked
staged (GLSL first, port wired second).*

### Phase G — Verification hardening (08-14/15)

The golden-image harness prompt (with two recorded MCP traps quoted back to the
agent) found the project's worst bug within an hour of existing: completing the
first task **disabled the scene object hosting the composition root** — 13 LEAF
scenarios were green the whole time because none tested object lifetime. Locked
with `gate4-controller-survives-release`, verified **by reintroducing the bug**.
`Tools/build-gate.js` followed, each stage deliberately broken and confirmed to
fail loudly — discovering along the way that Lens Studio's bundled compiler
**exits 0 even when compilation fails**. Gate 6 ("test the gesture, not the
code behind it") added synthetic SIK pinches against live creatures.
*Outcome: three real bugs found by harnesses, not by eyes.*

### Phase H — Session 10: design polish + the animated menagerie (08-16, this machine)

The final session turned a verified-but-placeholder product into the submitted
experience. Every change below was verified in Preview by CLAD itself
(recompile → runtime logs → screenshot/LEAF) before being reported.

**H1 — Retro-UI polish across every window:**
```
lets remove the intro image then because of looks really ugly
then for all the windows - make the header on the window bigger and in bold text
+ remove the cross icon if its not functional
* for the start window make the body text bigger so it would be easy to read
For the middle screen where the experience is lets make the reminder smaller
For the message when the task is done we dont need to specify the task we have
just done again - remove it and make the window smaller
for the finish screen Make a text bigger in the middle - add icons in line and
put tasks in line
```
CLAD edited `RetroUi.ts` (per-dialog `bodyTextSize`/`bodyMono` options),
`UiLayout.ts`, `OnboardingFlow.ts`, `AmbientHud.ts` (reminder scaled to 66%,
pinned top-right), `EndOfDayView.ts`, removed the decorative close boxes by
editing `WindowPanel.svg`/`ReminderPanel.svg` and re-rasterizing via
`ConvertSvgToTexture`, and verified each screen with
`CapturePanelScreenshotTool`. *Outcome: worked; 2 sizing iterations.*

**H2 — Icon gallery + sparkle animation:**
```
for this end screen make the text even bigger
Let first be the icons of animals and under each of it let it be the task itself
For the meditation screen - lets add a nice animation happening on the
background then - i imported a sparkles inside the assets, can you check it?
```
CLAD drew **six pixel-art species icons as SVG** (dog/cat/owl/elephant/rabbit/
penguin, matching the retro chrome), rasterized them, and added an icon-gallery
row to `RetroDialog` (icons in one line, each task under its icon). It
inspected the imported `Sparkles Post Effect.lspkg`, identified it as a
brightness *detector* (nothing to detect in a dim room), and built its own
guaranteed twinkle layer — 44 billboarded motes (two shapes), each pulsing on
its own phase and drifting upward. *Outcome: 3 placement iterations (world-math
→ camera-space → room-surround), each diagnosed with `QueryRuntimeSceneTool`.*

**H3 — Replacing the creatures with animated models (the session's core):**
```
@toon_cat_free.glb @rabbit_baby_-_animated_low_poly.glb @owl.glb
@manchot_the_penguin.glb @free_shar_pei_animated_dog.glb @cocofanto_elefanto.glb
also i want to replace the 3D models with the following - can you keep their
animation so they will be moving more naturally across the scene
```
CLAD parsed each GLB's structure (clips, tri counts, bind bounds) with inline
Python, swapped the prefabs, and wrote runtime **auto-scale normalization** —
necessary because the models are authored 5 orders of magnitude apart (cat
×0.04, elephant ×2360). First integration kept the old tint/dissolve shader
and rendered garbage (those meshes lack the baked COLOR_0 data); CLAD switched
to per-instance clones of the models' own textured materials and taught
`CreatureBehavior` to skip tinting (`supportsTint`). fps dropped 30 → 16;
CLAD decimated with gltf-transform (elephant 19.2k → 3.7k tris, penguin 4.1 →
1.3 MB) **preserving skins and animations**, restoring 30 fps —
`gate6-pinch-select` went from timing out to passing in 2.6 s.
*Outcome: 2 major iterations; verified by LEAF + screenshots.*

**H4 — Rest-still / move-animate, and the owl saga:**
```
im afraid that now those models are not interactive with the pressing and
holding to close them + they are overriding one another a lot
For the penguin that jumps its hard to catch him so let him stand and only for
the action make it jump like when it moves
* there is some random mesh for owl see on the screenshot
Overall for the models let them stand still and when moving to use animation,
is that doable?
```
CLAD implemented exactly that: each creature holds a frozen natural pose (a
looping 10 ms sliver of its idle clip — a 60 ms sliver visibly *shook*, one
iteration) and plays its walk/waddle clip only while its measured horizontal
speed crosses a hysteresis gate. The owl's "random mesh" was diagnosed from the
GLB bytes: its parts are **exploded in bind pose** and assembled only by
scale-compensation joints Lens Studio doesn't apply — unfixable, reported as
such. The user supplied a replacement (`here is the new owl model`), which CLAD
integrated — then discovered its joint-scale rig makes **every runtime AABB
lie** (reported 28 cm, rendered 21 m), and calibrated a manual scale from
editor-side bounds queries. *Outcome: 3 iterations; final owl 670 tris with
idle/fly clips.*

**H5 — The done-flow crash, found from a screenshot:**
```
the done process is still not functional
```
The user's screenshot included the Logger; CLAD read the stack trace from it
(`TypeError: Cannot read property 'x' of undefined` in `forceOpaque`) — the
release effect assumed every material exposes `baseColor`, which the textured
GLB materials don't. Guarded three call sites, added a warm-white particle
fallback, replaced the now-impossible dissolve melt with an eased **shrink**
release. `gate6-pinch-hold-resolve` passed with the full card flow.
*Outcome: fixed in one pass once the trace was visible.*

**H6 — Restart hygiene and "renew every time":**
```
when restarted the models are not disappearing and keep standing - check it pls
```
```
the tasks are storing somewhere, i just opened the menu and I see this -
make it renew every time
```
CLAD implemented the long-deferred world-gating (creatures hidden while
onboarding owns the stage; verified: restart with 6 persisted tasks shows a
clean intro, creatures appear on close) and `startFreshDay()` — the intro's
buttons discard every leftover task (verified in logs: 6 `discarded task=`
lines on click). **This introduced a regression CLAD then caught itself**: LEAF
scenarios seed creatures while onboarding is open, so they spawned disabled and
pinches timed out — fixed by making the gesture harness close onboarding
properly before seeding, and re-proven with two consecutive green runs.
*Outcome: worked after 1 self-inflicted, self-caught iteration.*

**H7 — Final sizing and the invisible end-screen:**
```
1. mke the animals little bigger, like 20% more
2. the finish screen is not visible, might be some error with rendering
```
```
i still cant see the end screen image anywhere on the location, double check it pls
```
Creatures +20% (34 cm). The "invisible finish screen" was two stacked windows
on one anchor (completion card + TODAY.TXT interleaved — reproduced in a
screenshot, fixed by dismissing the card). The backdrop was a genuine
**rendering bug found by geometry analysis**: the quad's rotation used yaw with
the wrong sign, so at any heading off world-north its front faced away and
backface culling erased it — plus it hung 4.5 m out, behind most rooms' real
walls. Fixed (−yaw, two-sided, 3 m), verified at an arbitrary heading in the
Evening Outdoor environment. Also cut ~15 MB of packed size (audio 18.9 →
4.7 MB, textures resized). *Outcome: all verified with before/after captures.*

---

## 4. Iterations & Fixes

| Problem | Fix prompt (quote) | Outcome |
|---|---|---|
| Generated cat had painted eyes; unlit pipeline discards textures | "…two separate solid spheres that BULGE OUT from the face, like buttons sewn onto a plush toy…" | Passed; phrasing reused for 4 more species |
| Creatures floated; fix "verified" only where it was tuned | "The creatures float again after I switched the Preview environment… Report where the floor Y comes from right now" | 3 rounds, 3 distinct root causes (dual constants → sinking at 7 cm/s → pitch-scaled depth); all closed with runtime values |
| App silently froze after first completion; 13 tests green | "Lock the freeze bug so it cannot come back… All 12 existing scenarios passed while this bug was live… Close that gap explicitly." | `gate4-controller-survives-release`; verified by reintroducing the bug |
| New animated models rendered garbage under the tint shader | (diagnosed from CLAD's own runtime capture) | Kept authored textures, per-instance clones; tint channel gated off |
| First owl model = scattered parts (scale-compensation rig) | "If owl is bad then replace it with this mode[l]" → "here is the new owl model" | New 670-tri owl integrated; broken one documented |
| New owl rendered 21 m tall; every runtime AABB lied | "wow the owl is huge , make it like other animals pls" | Manual scale calibrated from editor-side bounds (60→72) |
| Six textured models halved preview fps (30→16); LEAF pinches timed out | mesh-optimization instruction (decimate "PRESERVING their skeletons, skinning weights, animations, and textures") | elephant 19.2k→3.7k tris, penguin −68% size; 30 fps and green LEAF restored |
| Hold-to-resolve crashed (`TypeError` in `forceOpaque`) | "the done process is still not functional" (+ Logger screenshot) | baseColor guards + shrink release; hold-resolve scenario green |
| Standing creatures visibly shook | "when standing still - the models are shaking a little… can you check it pls" | Rest-pose loop window 60 ms → 10 ms; shake gone |
| World-gating broke the LEAF gesture harness (self-inflicted) | (caught by two consecutive scenario failures) | Harness closes onboarding before seeding; 2 green runs |
| End-screen backdrop invisible at most headings | "i still cant see the end screen image anywhere on the location, double check it pls" | Facing bug (−yaw) + two-sided + 4.5→3 m; verified at arbitrary heading |

---

## 5. Highlights — Most Effective Prompts

1. **The one-line domain commission** — *"continue to the next frozen-plan
   step: the data layer."* Because the contract lived in `CLAUDE.md` before any
   code, one sentence produced the entire domain layer (repository, storage,
   clocks, state engine, arbiter) that survived unchanged to submission. The
   spec was the prompt.

2. **The golden-harness prompt** — commissioned a visual regression harness
   "for a person who is not its author," fed two previously-logged MCP traps
   back as constraints, and demanded non-visual assertions per frame. Within an
   hour the harness found the freeze-on-first-completion bug that 13 green
   domain tests could not see.

3. **The menagerie swap** — *"i want to replace the 3D models with the
   following - can you keep their animation so they will be moving more
   naturally across the scene."* One prompt (plus six raw downloaded GLBs)
   yielded GLB introspection, runtime auto-scale across 5 orders of magnitude,
   clip selection, textured-material adoption, decimation with rigs preserved,
   and an fps regression found and fixed — all verified through LEAF and
   screenshots in the same session.

4. **Behaviour as one sentence of intent** — *"Overall for the models let them
   stand still and when moving to use animation, is that doable?"* CLAD turned
   a plain-language product wish into a locomotion state machine (frozen-pose
   clip slivers, speed hysteresis, per-species clip preferences) and verified
   it live, including diagnosing why one model could never stand still.

---

## 6. Learnings

- **Write the invariants before the code, then prompt against them.** The
  frozen `CLAUDE.md` contract turned later prompts into one-liners and let
  every session (across two machines and two agent products) start aligned.
- **Feed failures back as constraints.** The most reliable prompts quoted the
  project's own logged traps ("a previous graph edit produced silently black
  bodies…do not fall into this again") — the agent designs around a failure it
  is told about.
- **Make CLAD verify with instruments, not adjectives.** Demanding runtime
  values, screenshots, LEAF runs and "prove it fails" for every checker caught
  wrong fixes that plausible-sounding summaries would have shipped — including
  a "grounded" claim overturned by its own captures.
- **Screenshots are a debugging channel in both directions.** Pasting the
  editor with the Logger visible let CLAD read the actual stack trace; CLAD's
  own preview captures diagnosed facing bugs, overlapping windows and a
  21-meter owl that every runtime query swore was 28 cm.
- **Let the agent say "this asset is unfixable."** The first owl's
  scale-compensation rig genuinely cannot assemble in Lens Studio; the honest
  finding (report → human supplies a replacement) was faster than any
  workaround would have been.
