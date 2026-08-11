# Task Organism Handoff

## Current checkpoint

Day 1 Emotional Prototype / Character Vitality is frozen as the **technical character checkpoint**. Gate 2 Product Truth is implemented and fully LEAF-verified; interaction work has not started.

Environment: Lens Studio 5.23.1, SPECS 27 target, Interactive stereo Preview, SIK/UIKit installed, `lens-studio` MCP connected and authenticated. Blender is intentionally unavailable and not required.

## Completed work

- Procedural low-poly lathe blob with unlit body material and optional per-vertex wobble.
- Two procedural eye objects intended to establish a readable front.
- Idle breathing, wander, squash/stretch, and periodic camera glance.
- Direct-transform cat-like chase with capped speed/acceleration, 1 m hard stop, 1.1–1.3 m target range, and 8–12 degree side offset.
- Idempotent presentation-only release API with brighten, particles, optional audio hook, and cleanup.
- Debug trigger for chase, end-chase, release, reset, habitat recenter, and auto-cycle.
- Camera, SIK, creature, debug harness, and preview inspection agent are present and wired in the authored scene.
- Replaceable character presentation is isolated under `VisualRoot`; `MovementRoot` owns movement/controller behavior independently.
- `TaskRecord`, `Clock` (`RealClock`/`DemoClock`), versioned persistent storage, memory storage, and `TaskRepository` are implemented.
- Repository enforces six open tasks, copy-on-read, clock-based snooze, idempotent resolve, and removal of completed tasks from storage.
- LEAF 2.0.2 is installed with a Preview scenario for the data layer.
- `StateEngine` derives urgency/state exclusively from an injected `Clock`.
- `AttentionArbiter` applies the required threshold and selects at most one chaser.
- `TaskResolutionService` persists an idempotent resolve before emitting one presentation release callback.

## Modified files

Existing implementation (already committed before this handoff):

- `Assets/Scripts/Config/CreatureConfig.ts`
- `Assets/Scripts/Creature/BlobMeshBuilder.ts`
- `Assets/Scripts/Creature/CreatureBehavior.ts`
- `Assets/Scripts/Creature/CreatureEyes.ts`
- `Assets/Scripts/Creature/CreatureMaterials.ts`
- `Assets/Scripts/Creature/CreatureMovement.ts`
- `Assets/Scripts/Creature/LatheGeometry.ts`
- `Assets/Scripts/Creature/ReleaseEffect.ts`
- `Assets/Scripts/Debug/CreatureDebugTrigger.ts`
- `Assets/Materials/BlobBody.mat`
- `Assets/Materials/BlobEye.mat`
- `Assets/Scene.scene`

Modified in this session:

- `Assets/Scripts/Debug/CreatureDebugTrigger.ts` — release trigger now issues two calls in one tick to exercise idempotency.
- `Assets/Scripts/Creature/ReleaseEffect.ts` — one release-start log for deterministic Preview verification.
- `prompts.md` — real CLAD inspect/observe/test/verify cycles.
- `HANDOFF.md` — acceptance status and next step.
- `Assets/Scripts/Config/CreatureConfig.ts` — pear profile, stronger deformation, tilt, eye, and blink constants.
- `Assets/Scripts/Creature/LatheGeometry.ts` — optional per-ring X offsets for asymmetric lathed forms.
- `Assets/Scripts/Creature/CreatureEyes.ts` — dimensional unequal eyes, pupils, gaze offset, and blinking.
- `Assets/Scripts/Creature/CreatureAppendages.ts` — procedural flippers with secondary lag.
- `Assets/Scripts/Creature/CreatureShadow.ts` — lightweight unlit contact shadow.
- `Assets/Scripts/Creature/CreatureBehavior.ts` — presentation assembly and whole-body secondary motion.

Preserve existing untracked inspection artifacts:

- `.virtual-scene.json`
- `Packages/AiPreviewAgentInspect.lspkg`
- `Packages/AiPreviewAgentInspect.lspkg.meta`

## Verification status

- Git audit: no tracked working-tree or staged diff before this handoff; only the inspection artifacts above were untracked.
- TypeScript: PASS (`RecompileTypeScriptTool`, no compiler errors).
- Runtime startup: PASS (`RunAndCollectLogsTool` refresh, no project errors; SIK 0.18.0 initialized).
- Authored wiring: PASS for Camera -> `CreatureBehavior`, Debug -> `CreatureBehavior`, Body/EyeLeft/EyeRight/ParticleAnchor hierarchy, Perspective camera, and DeviceTracking World.
- Runtime inspection: PASS for procedural Body and both Eye RenderMeshVisual components existing.
- Visual Preview: PASS. Recentered chase capture shows both eyes clearly.
- Idle vitality: PASS. Separate live samples show changing position and breathing scale; wander/glance code is active.
- Chase comfort: PASS. Observed distance ~126 cm and side offset ~8.5°, within the frozen 1.1–1.3 m and 8–12° ranges and outside the 1 m hard stop.
- Release idempotency: PASS. The harness invoked `release()` twice in one tick and produced one `[ReleaseEffect] play` line per Preview lifecycle.
- TypeScript/runtime: PASS. Compile succeeded; refreshed logs had no errors.
- Gate 1 silhouette: PASS after redesign. Isolated front/three-quarter captures and the real user-view chase capture show a bottom-heavy tilted pear body, dimensional gaze, two flippers, body lean, and contact grounding.
- Presentation boundary: PASS. Runtime hierarchy shows `MovementRoot` with the controller only and all replaceable body/face/flipper/shadow/release nodes and audio under `VisualRoot`.
- Body opacity contract: PASS at asset and runtime state level (alpha/fallback opacity 1, blend disabled, depth test/write enabled). Remaining capture streaking is scheduled material/render polish debt.
- Data layer: PASS. `task-organism-data-layer` succeeded in LEAF Preview; TypeScript and refreshed runtime logs were clean.
- Gate 2.1: PASS — three fresh tasks produced zero chasers.
- Gate 2.2: PASS — one threshold-crossing task produced exactly one chaser.
- Gate 2.3: PASS — snoozing that task produced zero chasers.
- Gate 2.4: PASS — advancing beyond snooze expiry restored exactly one chaser.
- Gate 2.5: PASS — separate seed/restore LEAF runs restored the same task id and text across a Lens reset.
- Gate 2.6: PASS — a restored task transitioned from elapsed time immediately under `DemoClock`.
- Gate 2.7: PASS — two resolve calls caused one repository save and one release callback.
- Gate 2.8: PASS — `StateEngine` contains no `Date.now()`; time is injected through `Clock`.

## Unresolved issues

1. `task-organism-plan-v3-final.md` is missing from the repository.
2. `task-organism-playbook-v3.md` is missing from the repository.

## Scheduled polish-phase art debt

- Replace the technical procedural body with a production-quality soft bean/mochi silhouette while preserving `VisualRoot` scale and the `CreatureBehavior` API.
- Improve material response and color separation across bright/dark environments without changing the unlit, opaque, lightweight constraint.
- Refine eye embedding, eyelid forms, pupil/catchlight consistency, and three-quarter readability.
- Refine flipper-to-body transitions and secondary-motion weighting.
- Refine contact-shadow shape/softness and release-particle art.
- Re-evaluate apparent size versus camera FOV: the verified 35.5 cm creature at roughly 1.2 m occupies about 44% of the current 36.6° vertical Preview frame, so the prior one-third framing request conflicts with the frozen 35–45 cm and 1.1–1.3 m constraints.

These are explicit art-polish tasks, not blockers for the technical character checkpoint or authorization to redesign during the data-layer phase.

## Exact next step

Begin the frozen interaction slice only on explicit direction: short pinch selects, 0.6–0.8 s hold resolves with progress, and early release cancels. Preserve the rule that select and resolve never fire from the same gesture.

## Do Not Repeat

- Do not rebuild the procedural blob, movement, eyes, or release effect.
- Do not re-diagnose the old one-eye screenshot; live chase verification established that the face is readable.
- Do not start selection/hold interaction wiring before the Gate 2 checkpoint is accepted.
