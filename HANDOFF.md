# Task Organism Claude Handoff

## Handoff Route

- From: Codex
- To: Claude

## Current Milestone

Functional Wednesday vertical slice complete.

## Gate Status

- Gate 2: passed.
- Gate 3: technically integrated but not human-validated.
- Do not claim comprehension evidence from the failed 18.7-second recording or proceed as though the presentation gate has passed.

## Recording Constraint — Additive Display

The SPECS Preview composites rendered Lens content additively over the passthrough background rather than occluding it (see `prompts.md`, "Additive display investigation"). A fully opaque object can still read as washed-out/see-through against a bright background (sky, lit windows) purely because of this compositing model — no material or mesh change fixes it. `BLOB_COLOR` was retuned to a saturated amber-gold to read as well as possible across both dark and moderately bright backdrops, but no color choice fully escapes wash-out against a very bright one.

**All demo recording must be done against a dark background.** Avoid framing that puts bright sky, lit windows, or other bright surfaces directly behind a creature.

## Latest Verified Preview Sequence

One uninterrupted Preview lifecycle provided this technical evidence:

1. Clean start logged `ready open=3 hold=1.5s chaser=none`: three tasks spawned and there were zero initial chasers.
2. Demo advance logged `chase cue look-pause root=MovementRoot_1`, `arbiter chaser=demo-1`, and `time advanced now=86400001 chaser=demo-1`: exactly one creature became urgent.
3. The chaser faced the camera, held a 0.3-second look pause, made one anticipation dip, and approached while the other two remained grounded at their habitat anchors.
4. Short pinch logged `interaction hold root=MovementRoot_1` and `selected task=demo-1 chaseHeld=true`. Preview showed the opaque full-task panel for `Send the project update`, the large hold instruction/progress treatment, and `Later`.
5. A separate reacquired hold logged 25%, 50%, 75%, and 100% progress.
6. Completion ordering was `repository saved completion task=demo-1 open=2`, then exactly one `[ReleaseEffect] play`, then `release requested task=demo-1 remaining=2`.
7. Final runtime inspection found only `MovementRoot_2` and `MovementRoot_3` enabled, both on the shared floor plane, with `Book a dentist ap...`, `Water the balcony...`, and `2 tasks remaining` visible.
8. TypeScript compilation passed after the correction. `git diff --check` also passed before the implementation commit.

This establishes technical integration, not human validation. The next recording must make front orientation, grounding, the chaser transition, selection UI, hold progress, release, and the final two-creature frame readable in one run.

## Latest Commit Hashes

- `bcfe295b59f68be76580abd8a24df14a8fc835d9` — `fix: clarify vertical-slice presentation`
- `46db5dd` — `feat: complete judge-facing vertical slice`
- `b6a9e1b` — `feat: complete gate 3 interaction loop`
- `7989312` — `feat: verify gate 2 product truth`

## Frozen v3 Documents

The frozen v3 documents are currently located in the parent directory, not the project directory:

- `../task-organism-playbook-v3.md`
- `../task-organism-plan-v3-final.md`

Do not modify their frozen scope.

## Preservation Constraints

- Do not repeat or rewrite the backend, repository, persistence, arbiter, or interaction contracts.
- Preserve the verified presentation correction and accepted creature scale behavior.
- Do not stage unrelated metadata, packages, textures, or inspection artifacts.
- Do not begin by restructuring movement/controller systems; the production visual remains isolated beneath each creature's `VisualRoot`.

## Known Art Debt

- Placeholder onion-like character silhouette.
- Transparency/streaking appearance in captures.
- Production materials and color separation.
- Eye forms, embedding, pupils, and catchlights.
- Flipper forms and body transitions.
- More legible release polish.

These are presentation debts. They are not authorization to rewrite verified systems.

## Exact Next Step

Begin the controlled Thursday visual pass. Improve or replace only `VisualRoot`, preserving its movement/controller boundary, accepted presentation scale, grounding, task labels, and all verified contracts. Then record the complete Preview flow and human-validate Gate 3.

No visual asset or `/build-mesh` work was started during this handoff.

## Remaining Unrelated Dirty Working-Tree Files

These pre-existing files and artifacts were deliberately left unstaged and untouched by the handoff commits:

- `.gitignore`
- `AGENTS.md`
- `CLAUDE.md`
- `Assets/Scripts/State/AttentionArbiter.ts.meta`
- `Assets/Scripts/State/StateEngine.ts.meta`
- `Assets/Scripts/State/TaskResolutionService.ts.meta`
- `Assets/Tests/Gate2ElapsedRestoreScenario.ts.meta`
- `Assets/Tests/Gate2LifecycleScenario.ts.meta`
- `Assets/Tests/Gate2PersistenceRestoreScenario.ts.meta`
- `Assets/Tests/Gate2PersistenceSeedScenario.ts.meta`
- `Assets/Tests/Gate2ResolveScenario.ts.meta`
- `Assets/Tests/Gate2Support.ts.meta`
- `Assets/Tests/Gate3CompletedHoldScenario.ts.meta`
- `Assets/Tests/Gate3EarlyCancelScenario.ts.meta`
- `Assets/Tests/Gate3InputParityScenario.ts.meta`
- `Assets/Tests/Gate3LaterScenario.ts.meta`
- `Assets/Tests/Gate3NoConflictScenario.ts.meta`
- `Assets/Tests/Gate3ShortPinchScenario.ts.meta`
- `Assets/Tests/Gate3Support.ts.meta`
- `.gitattributes`
- `.virtual-scene.json`
- `Assets/Textures/`
- `Packages/AiPreviewAgentInspect.lspkg`
- `Packages/AiPreviewAgentInspect.lspkg.meta`
- `Packages/AiPreviewAgentInteract.lspkg`
- `Packages/AiPreviewAgentInteract.lspkg.meta`
- `jsconfig 2.json`
