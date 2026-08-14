# Full technical verification — Task Organism

Read-only pass. Nothing found here was fixed; everything is recorded.

**Filename note:** requested as `VERIFICATION-2026-08-13.md` and delivered under
that name. The evidence in it was collected on **2026-08-14**; the `08-13` in
the title matches the prior `AUDIT-2026-08-13.md` rather than the run date.

**Method.** Every VERIFIED line below is backed by something that ran in this
session — a LEAF scenario result, a runtime scene query, a log line from an
actual Preview run, or a tool invocation. Where a claim rests on reading code, it
says ASSUMED. Where something is wrong, it says BROKEN. No negative result has
been rounded up.

**Primary evidence sources**
- LEAF suite run in full this session: **13/13 succeeded**
- The Lens Studio session log (`LensStudioLog-2026-08-11-14-20-18-443-6657f.txt`),
  which covers the whole project's Preview history and is the basis for every
  "has this ever actually run" claim
- Live `QueryRuntimeSceneTool` queries against the running Preview
- `Tools/visual-regression.js` executed against the committed golden set

---

## Part 1 — subsystem status

### Domain

| Item | Status | Evidence |
|---|---|---|
| Task creation, DemoInput | **VERIFIED** | `gate3-input-parity` passed; runtime logs show 6 demo tasks seeded every run |
| Task creation, KeyboardInput | **VERIFIED (domain only)** | Log: *"KeyboardInput created equivalent records through TaskCreationService"* ×8, from `gate3-input-parity`. See Part 2 — the live keyboard path has never driven the running Lens |
| Persistence across restart | **VERIFIED** | `gate2-5-persistence-seed` + `gate2-5-persistence-restore` passed. Live restore also observed: *"partial save (5/6 open) — reseeding for the demo sequence"* on nearly every refresh |
| Elapsed-time transition without waiting | **VERIFIED** | `gate2-6-8-elapsed-clock` passed; runtime *"time advanced now=155520000 chaser=demo-1"* |
| Urgency computation + threshold gating | **VERIFIED** | `gate2-1-4-chaser-lifecycle` passed (3 fresh → 0 chasers → age → exactly 1) |
| Snooze and expiry | **VERIFIED (domain only)** | `gate3-later-snooze` passed. The runtime path has never executed — see Part 2 |
| Resolve idempotency | **VERIFIED** | `gate2-7-resolve-idempotency` passed: two resolves → one save, one release |
| Storage v5 schema | **VERIFIED** | `DEMO_STORAGE_KEY` = `…v5.presentation`; reseed-on-partial-save observed live |
| Corrupt-payload recovery | **VERIFIED** | `DataLayerScenario` feeds `"{not valid json"` and asserts `load().length === 0`; passed |

### Composition

| Item | Status | Evidence |
|---|---|---|
| Exactly one controller | **VERIFIED** | Runtime query: one `TaskOrganism (controller)`, `enabled: true`, `parentName: null` |
| Controller alive after release | **VERIFIED** | `gate4-controller-survives-release` passed; `[Capacity]` log lines continue past `beat=RELEASED` |
| Controller alive after **both** releases | **VERIFIED** | Full runs reach `beat=SECOND_RELEASED t=25.5s open=4`, which requires the controller to still be updating 8s after the first release |
| Arbiter promotes after each release | **VERIFIED** | `arbiter chaser=demo-2` after release 1, `arbiter chaser=demo-3` after release 2 |
| Six-slot capacity layout | **VERIFIED** | Six `habitat task=demo-N slot=N/6` lines with lateral −45/−15/15/45 front, ±22.5 at depth +45 back |
| Runtime cloning from CreatureTemplate | **VERIFIED** | `CreatureTemplate` present and `enabled: false`; `CreatureSlotClones` has `childCount: 3`; no *"no CreatureTemplate"* fallback line has ever been logged (0 occurrences) |

### Presentation

| Item | Status | Evidence |
|---|---|---|
| Grounding, six species at rest | **VERIFIED** | Harness assertion `groundedOk=6 groundedBad=0`; **`GROUND FAIL` has never been logged (0 occurrences project-wide)** |
| Grounding while chasing | **VERIFIED** | Same assertion at the `03-approach` frame with `chasing=1` |
| Facing | **VERIFIED** | Per-species measured (`head Z range`) and baked; side-by-side isolate captures showed cat/owl matching the dog convention |
| Calm / restless / chasing distinction | **VERIFIED** | Posture spread confirmed at capacity, plus `chasing=0/1` transitions in the arbiter log |
| Palette identity at every urgency level | **VERIFIED** | Captures at forced urgency 0 / 0.5 / 1.0 with all six palette colours in frame; hue preserved at every level |
| Urgency halo at 0, 0.5, 1.0 | **VERIFIED (historically), NOT RE-RUNNABLE** | Captured when `DEBUG_FORCE_URGENCY` existed. **That harness was removed**, so this can no longer be re-exercised without re-adding code. Flagged in Part 4 |
| Reduced tint fallback (0.05/0.09) | **VERIFIED** | Captured on both dark and bright backdrops after the change; palette intact |
| Release particles | **VERIFIED** | `[ReleaseEffect] 30 particles enabled from pool` |
| Particle pooling | **VERIFIED** | Runtime query: 180 `ReleaseParticle` objects (6×30) present and `enabled: false` between releases; **`pool MISSING` never logged (0)**; release frame 551.3 → 223.7 ms |

### Interaction

| Item | Status | Evidence |
|---|---|---|
| Short pinch selects | **VERIFIED** | `gate3-short-pinch-select` passed; runtime `selected task=demo-1 chaseHeld=true` |
| Hold resolves | **VERIFIED** | `gate3-completed-hold` passed; runtime hold 25→50→75→100% then save+release |
| Early release cancels | **VERIFIED** | `gate3-early-hold-cancel` passed (needed one retry after a bridge timeout — see Caveats) |
| Select and resolve never conflict | **VERIFIED** | `gate3-no-gesture-conflict` passed |
| Later snoozes | **VERIFIED (domain only)** | `gate3-later-snooze` passed. Runtime path never executed — Part 2 |
| 80+ character task does not break layout | **ASSUMED** | `TaskTextFormatting.ts` truncates to 2 × `SELECTION_LINE_MAX_CHARS` (30) with word-break and ellipsis. **No test covers it and no fixture exceeds it** — the longest demo task is well under. Never exercised at any length that triggers truncation |

### Audio

| Item | Status | Evidence |
|---|---|---|
| Stir on calm→restless | **VERIFIED** | 178 log occurrences; fires on exactly the creatures crossing, not the already-urgent one |
| Pad on →chasing | **VERIFIED** | 101 log occurrences; fires on the single chaser, and again on the second chaser |
| Settle on snooze | **BROKEN — never fires** | **0 occurrences of `[StateAudio] settle` in the entire project log.** The cue exists, the WAV ships, the call site exists — it has never run |
| Stagger | **VERIFIED** | Deterministic offsets `+0.09 / +0.12 / +0.21s`, byte-identical across three consecutive runs |
| Window cap (3 per window) | **NEVER EXERCISED** | **0 occurrences of `DROPPED (budget)`.** The demo spread never crosses more than two creatures at once, so the limiter has never engaged |
| Audio listener | **VERIFIED** | `[StateAudio] audio listener created on Camera Object` ×107; `audio listener FAILED` never logged |
| Spatialisation configured | **VERIFIED (configuration only)** | `SpatialAudio.enabled` + `DistanceEffect` 60–700 cm set on both components per creature. **Audibility not verified** — Part 4 |

### Tooling

| Item | Status | Evidence |
|---|---|---|
| Golden comparator | **VERIFIED** | Run this session: golden-vs-golden → `PASS`, all 7 frames 0.00%, exit 0. Previously also shown to FAIL correctly (7.36% on a substituted frame, `MISSING CAPTURE` on a deleted one) |
| Seven golden frames present | **VERIFIED** | 7 PNGs in `docs/golden/` |
| Golden frames **current** | **BROKEN — stale** | Goldens committed `11:53:56`; clip mode `12:25:38`; particle pooling `12:52:49`. **The goldens predate both**, so they still show the staging panel that clip mode hides. A comparison against the shipping build would fail on all seven frames for reasons that are not regressions |
| LEAF suite | **VERIFIED** | 13/13 this session |

---

## Part 2 — wired but never exercised

Ordered by how likely each is to hide the next freeze bug.

1. **The runtime snooze path — the whole chain.** `TaskSelectionView`'s Later
   button → `interaction.later()` → `creature.endChase()` →
   `creature.playSnoozeCue()` → status *"N tasks • deferred"*.
   **Evidence it has never run: 0 occurrences of `[StateAudio] settle` and 0
   occurrences of `deferred` in the project log.** The LEAF scenario covers the
   repository call; nothing has ever exercised the UI path, the cue, or the
   status update. This is the largest untested surface in the build, and it is
   user-reachable.

2. **The 3-per-window audio cue cap.** 0 `DROPPED (budget)` occurrences. Correct
   by construction and by reading; never engaged, because the demo spread only
   ever crosses two creatures simultaneously.

3. **`CreatureBehavior.petSpecies` — a dead `@input`.** Declared and visible in
   the Inspector, read by **nothing** (species comes from `appearanceSeed` via
   `speciesForSeed`). A designer can change it and nothing happens. Actively
   misleading on the handoff surface.

4. **Two inert Art Direction sliders.** `habitatLabelMaxChars` and
   `selectionLineMaxChars` are published on the panel and copied into `ART`, but
   **no consumer reads them** — `TaskTextFormatting.ts` still imports the raw
   `HABITAT_LABEL_MAX_CHARS` / `SELECTION_LINE_MAX_CHARS` constants directly. The
   only references to the `ART` fields are the panel's own default initializers.
   Dragging either slider does nothing. (`selectionPanelYCm` by contrast has a
   real consumer in `TaskSelectionView`.)

5. **`CreatureDebugTrigger` and its four boolean flags.** `triggerChase`,
   `triggerEndChase`, `triggerRelease`, `triggerReset` — attached in the scene,
   all default `false`, none ever flipped in any logged session.

6. **Dead constants** — declared, never read anywhere including inside
   `CreatureConfig.ts`: `VISUAL_BASELINE_SCALE`, `ELEPHANT_BODY_TO_BBOX_RATIO`
   (the elephant scale uses a literal `0.9992` instead), `MOUTH_ENABLED`.

7. **Live KeyboardInput.** Exercised by `gate3-input-parity` at the domain level,
   but never used to drive the running Lens — and cannot easily be, since the
   Preview panel captures arrow keys, WASD and bare letters for its own camera
   (recorded earlier in `prompts.md`).

8. **Text truncation at length.** `TaskTextFormatting`'s two-line break, ellipsis
   and hard-slice branches have no test and no fixture long enough to reach
   them.

9. **The elephant asset is shipped but its scale constant is bypassed** — see 6.
   The species itself is in rotation and rendering; only the named ratio
   constant is dead.

---

## Part 3 — CLAD inventory

Call counts are approximate, from this session's history and the project log.

### Used and load-bearing — the result is in the shipped build

| Capability | ~calls | What it produced |
|---|---|---|
| `ExecuteEditorCode` | 40+ | SPECS text-to-3D create/poll for all 6 generations; Perfetto trace start/stop for 10 captures; project save (twice, without which the scene changes never reached disk) |
| `RunAndCollectLogsTool` (`mode: refresh`) | 60+ | The only true Lens reset. Every verification, every harness frame, every trace run depends on it |
| `run_leaf_scenario` | 80+ | The 13-scenario suite; the regression proof for the controller-survives-release fix |
| `CapturePanelScreenshotTool` / `PreviewPanelTool screenshot` | 30+ | Every first-person capture, the golden set, the clip-mode verification |
| `CaptureRuntimeViewTool` | 40+ | Isolated per-species acceptance renders; the side-by-side facing and scale comparisons |
| `QueryRuntimeSceneTool` | 25+ | Object-graph truth: transforms, worldScale, the 180 pooled particles, the single controller |
| `RecompileTypeScriptTool` | 30+ | Compile gate before every refresh |
| `scene-graphql` | 12 | `CreatureTemplate` duplicate, controller component removal, backdrop transform, enable/disable |
| `VirtualScene` (read + apply) | 8 | Scene introspection; created the Art Direction and TaskOrganism objects; stored Inspector defaults |
| `build-mesh` skill (SPECS text-to-3D) | 7 jobs | Five shipped species + two rejected attempts |
| `build-sfx` skill | 2 runs | 3 release cues + 3 state cues, all shipped |
| `shader-graph` skill | 1 | `PetBody.graphShader` structure — the vertex-shading and urgency-halo shader |
| `specs-capture-perf-trace` skill | 10 captures | Every performance number quoted in `prompts.md` |
| `perfetto-trace-analysis` skill | 6 | Frame-time distributions and slice attribution |
| `ShowPropertyControlsTool` | 1 | Ten live sliders for the designer handoff |
| `GetBoundingBox` | 3 | Attempted mesh measurement — **failed** (no colliders); fell back to GLB parsing. Listed here because the fallback is what shipped |

### Used and discarded

| Capability | Why |
|---|---|
| Graph-shader node editing on `unlit.graphShader` | Rendered every body **silently black**, no compile error. Isolated to the graph rather than the bake, then abandoned for the codeNode route. Root cause never identified |
| `SearchLensStudioAssetLibrary` / `InstallLensStudioPackage` (Kitty.lspkg) | Installed, then reverted: FBX + skinned + autoplaying AnimationPlayer + PBR, and no Blender/FBX2glTF locally to convert |
| Synthetic bright-backdrop quad (`VirtualScene` + `scene-graphql`) | Never rendered in the ortho capture path — outside the volume, then edge-on as an XZ plane, then still absent when rotated. Abandoned for the real Preview environment, which was the better test anyway |
| `InjectPreviewGesture` / `PreviewInteractTool` | Used early for the staging buttons; abandoned as the driving mechanism for the golden harness in favour of deterministic beat-jumping, which removes timing from capture entirely |
| `normalize_glb.js` (from `build-mesh`) | Miscomputed scale on gltf-transform-simplified files (collapsed AABB to ~0.5 cm). Replaced by the hand-rolled `prepare-pet-glb` → `seat-pet-glb` pipeline |
| FAST3D (`GenerateFast3DAssets`) | Deliberately not used: the skill makes it a user-granted speed exception and the user granted the opposite ("quality is the priority, not speed") |

### Available and not used — with judgement

| Capability | Judgement |
|---|---|
| `MergeMeshesTool` | **Would be theatre.** Every species is already one primitive with one material; there is nothing to merge, and merging across creatures is forbidden by the independent-transform requirement |
| `SimplifyMeshTool` | **Real value, but not yet.** The vertex overage is genuine (5 of 6 over budget). But the overage is seam duplication, which simplification does not address, and the trace shows no vertex pressure in Preview. Using it now would be measuring nothing |
| `specs-lens-perf-attribution` | **Would be theatre today.** A differential sweep needs a problem to attribute; the one spike found was fully attributed and fixed by pooling |
| `MovePreviewCamera` | **Real value, unused.** Would have given controlled camera framing for the golden set instead of relying on the default Preview pose |
| `GenerateTexture` / `ResizeRasterTexture` / `ConvertSvgToTexture` | **Theatre.** The project is unlit with textures discarded by design |
| `GenerateLensIcon` / `IconSelector` | **Real value for submission**, not for the build. A Lens icon is a deliverable nobody has produced yet |
| `SearchLensStudioMusicLibrary` / `InstallLicensedMusic` | **Theatre, and against the brief.** Ambient music is explicitly out of scope in CLAUDE.md |
| `live-lens-tester` agent | **Partial.** LEAF was used heavily, but through direct tool calls rather than the agent |
| `specs-project-migrator`, `sync-kit-validator`, `editor-api-specialist` | **Not applicable** — no migration, no SyncKit, no bulk Editor API work |

### Which CLAD capabilities carried the most weight

Three did the real work. **SPECS text-to-3D** (`build-mesh`) is the one with the
largest product consequence: it produced five of the six creature species and, in
doing so, retired the project's licensing problem outright rather than
documenting it — a generated asset carries no third-party rights at all.
**The Preview instrumentation trio** — `RunAndCollectLogsTool` for the only real
Lens reset, `QueryRuntimeSceneTool` for object-graph truth, and
`CaptureRuntimeViewTool` for isolated renders — is what turned this project's
method from assertion into evidence; nearly every correction in `prompts.md` was
found by one of them contradicting something that looked right. And **LEAF**
carried the domain, though this audit is precise about its limit: the suite was
13/13 green throughout the entire period when completing the first task silently
disabled the composition root, because the scenarios exercise the domain and not
the object graph's lifetime. That gap is now closed by one scenario, `gate4`,
and the lesson is the more valuable output than the fix.

---

## Part 4 — the honest gaps

Everything currently claimed but not evidenced.

1. **Device performance is not cleared and cannot be.** Every number in the
   project is Lens Studio Preview on a desktop where `Track` — the Preview's own
   webcam and world tracking — consumes **78–82% of every frame**. Vertex, fill
   and material cost are all invisible behind it. "No pressure in Preview" is
   evidence about Preview. It says nothing about six creatures at 4,000–7,000
   vertices, a per-pixel rim shader and twelve spatialised audio sources on SPECS
   hardware. CLAUDE.md keeps the project preview-only; **this question is open.**

2. **Spatial audio audibility rests on configuration, not perception.** The
   listener exists and the distance effect is enabled — both verified. That a
   creature approaching from the left *sounds* left has never been heard by
   anyone. Needs a human with headphones; nothing in the toolchain can assert it.

3. **The vertex budget overage is unresolved.** 5 of 6 species exceed 4,000
   vertices (rabbit 7,034 against ~3,950 triangles). Recorded in
   `HANDOFF-VISUAL.md` with the reason plain decimation will not fix it and the
   warning that welding risks blending `COLOR_0` across seams.

4. **The golden set is stale** and would produce seven false failures against the
   shipping build. Recorded, not regenerated — regenerating is a write.

5. **The urgency halo can no longer be re-exercised.** `DEBUG_FORCE_URGENCY` was
   removed after the captures were accepted, so 0 / 0.5 / 1.0 cannot be
   reproduced without re-adding code. The captures are real; the *repeatability*
   is gone.

6. **Gates 1, 3 and 4 remain NOT VALIDATED.** Each requires 2+ human viewers
   reaching a comprehension verdict without narration. No viewer session has
   been recorded at any point in this project. This is unchanged from
   `AUDIT-2026-08-13.md` and is asserted nowhere as passed — but it is the
   single largest gap between what the build does and what the hackathon
   actually scores.

7. **No demo clip exists.** The toolchain has no video capture; only stills are
   possible. Recording requires a human screen-capturing the Preview.

8. **`CHASE_SIDE_OFFSET_MIN_DEG` / `MAX_DEG` are both 0**, where CLAUDE.md's
   spatial comfort rule specifies an 8–12° side offset. Carried forward
   unresolved from the previous audit; the chaser approaches dead-on.

9. **One LEAF scenario needed a retry.** `gate3-early-hold-cancel` timed out
   twice on the MCP bridge before passing on the third attempt. The Lens was
   healthy throughout (a refresh in between showed a normal full run), so this
   reads as bridge flakiness rather than a scenario defect — but it is recorded
   rather than smoothed over, and it means "13/13" required 15 invocations.

10. **Two-viewer comprehension of the two-completion story is untested.** The
    second completion was added on the reasoning that "one reads as a scene, two
    read as a system". That reasoning is untested on any viewer.
