# Task Organism — Piece 1: The Emotional Core

## Context

Task Organism is a spatial task manager for SPECS where unfinished tasks are living creatures. Before any task/data logic exists, we need the creature itself to feel alive: a single procedural blob with idle, chase, and release behaviors, driven purely by presentation code — no `TaskRecord`, no repository, no `StateEngine`/`AttentionArbiter`. This is the foundation everything else (multi-creature habitat, urgency-driven chasing, real task completion) will attach to later, so the seams matter as much as the visuals.

The project is currently a clean Specs Base Template — no `Assets/Scripts/`, no config file, no creature code exists yet (confirmed via direct survey). This plan builds it from scratch, reusing concrete API patterns pulled from the installed `ls-clad` Lens Studio agent-toolkit skills (MeshBuilder/lathe geometry, runtime material API, chase/easing math helpers) rather than inventing new approaches.

## Decisions (resolved with user)

- **Test trigger**: Inspector toggle (precise, scriptable `requestChase()`/`release()` calls) **plus** an auto-cycling idle→chase→release demo loop for hands-off demoing.
- **Post-release**: disable the creature SceneObject (not destroy) — safer against a stray double-release, allows a debug reset for repeat testing.
- **Placeholder sound**: generate a short, gentle chime now via the `build-sfx` skill (offline, license-clean synthesis) so the release effect is fully demoable today.
- **Blob look**: use a sensible default — soft egg/teardrop silhouette, ~15–20cm, warm neutral unlit color (cream/peach), matching the "cat-like, never monstrous" tone.

## Adjustments (day 1, before build)

Four changes to the plan above, made before implementation started:

1. **Wobble perf gate**: keep the per-vertex wobble, but gate it behind a `WOBBLE_ENABLED` constant in `CreatureConfig.ts`. `BlobMeshBuilder.updateWobble()` early-returns before both the per-vertex loop and the `builder.updateMesh()` call when disabled — `CreatureBehavior` keeps calling `updateWobble()` unconditionally every frame, so the on/off decision lives entirely in config, not behavior code. This is the main perf risk once multiple creatures (up to 6) run simultaneously, and needs to be a one-line toggle.
2. **Skip `build-sfx` today**: no chime is generated. The `AudioComponent` is still wired on `Creature` and `ReleaseEffect.play()` still calls it — but the wiring is a guarded no-op (`if (audio && audio.audioTrack)`) since `audioTrack` is left unassigned (defaults to `null`). Real sound design happens later in the week; only the hookup needs to exist today.
3. **Skip the LEAF scenario today**: manual preview verification only (see Verification below). No behavior change beyond making sure the public API — `requestChase()`, `endChase()`, `release()`, all zero-arg `void` — stays stable enough to write that scenario against later without a signature change.
4. **Habitat stays world-anchored; add a debug-only recenter action**: no change to the world-anchoring design — the habitat is still captured once at spawn/reset, not continuously recentered on the camera. Added `CreatureBehavior.recenterHabitat()` (a new public method, distinct from the AttentionArbiter-facing API) that re-reads the camera's current position/forward into `habitatCenter`/`habitatForwardYaw`/`wanderTargetY` and, if currently `IDLE`, immediately picks a fresh wander target so the effect is visible right away. Exposed as `triggerRecenterHabitat` on `CreatureDebugTrigger`, needed only for preview/recording — e.g. after the camera has drifted far from where the habitat was last anchored and the creature needs to be brought back into shot.

## File structure

```
Assets/Scripts/
  Config/
    CreatureConfig.ts        // every tunable constant for this piece
  Creature/
    BlobMeshBuilder.ts        // procedural lathe-sphere + per-frame vertex wobble
    CreatureEyes.ts            // two small front-facing eye primitives
    CreatureMaterials.ts       // runtime clone-before-mutate material helpers
    CreatureBehavior.ts        // main @component: state, idle/chase/glance, public API
    ReleaseEffect.ts           // one-shot particle burst + brighten + fade, idempotent-safe
  Debug/
    CreatureDebugTrigger.ts    // Inspector toggles + auto-cycle demo loop (deletable later)
Assets/GeneratedSFX/
  release-chime.wav            // generated via build-sfx
```

Module boundaries, briefly:
- **`CreatureConfig.ts`** — CLAUDE.md mandates one config file for thresholds/distances/speeds/timings; starting this convention correctly now means the future `StateEngine`'s `CHASE_THRESHOLD` etc. slot into the same file later.
- **`BlobMeshBuilder.ts`** — geometry only, no behavior knowledge, so it's reusable per-instance when multiple creatures (max 6) exist.
- **`CreatureEyes.ts`** — eyes are static primitives parented to the body's front anchor, not baked into the deforming blob mesh — a fixed, readable shape against a wobbling body.
- **`CreatureMaterials.ts`** — centralizes the runtime `mat.mainPass.*` clone-before-mutate pattern so brighten-on-glance and brighten-on-release don't duplicate it.
- **`CreatureBehavior.ts`** — the one `@component`, owns state (`IDLE`/`CHASING`/`RELEASING`) and the public API (`requestChase()`, `endChase()`, `release()`) that a future `AttentionArbiter` will call — the single integration seam.
- **`ReleaseEffect.ts`** — one-shot spawn→animate→destroy shape is different enough from continuous per-frame `UpdateEvent` behavior to warrant its own module; keeps the idempotency guard in one place.
- **`Debug/CreatureDebugTrigger.ts`** — isolated so it's a one-line deletion once a real arbiter exists.

## Scene wiring

Using the project's preset-first workflow (read → presets → re-read → apply → save via `scene-graphql`/`VirtualScene`):

1. Read current scene, confirm `Camera Object` ID, no conflicts.
2. Create root SceneObject `"Creature"` at scene root (world-space habitat object, not camera-attached), spawn position roughly `{0, -0.1, -1.3}` relative to camera-forward (inside the 1–1.5m habitat).
3. Children:
   - `Creature/Body` — hosts the runtime-created `RenderMeshVisual` from `BlobMeshBuilder`.
   - `Creature/EyeLeft`, `Creature/EyeRight` — parented under `Body` so they inherit breathing/squash scale.
   - `Creature/ParticleAnchor` — empty object at blob center, spawn origin for the release burst (keeps `ReleaseEffect` decoupled from blob geometry internals).
4. One `ScriptComponent` on `Creature` root wired to `CreatureBehavior.ts` — it internally owns the mesh builder, eyes, and delegates to `ReleaseEffect`. Mesh/eyes/release stay plain TS classes instantiated by it, not separate attached components (avoids fragile cross-object `@input` wiring for a single creature).
5. One `ScriptComponent` on a small `Debug` SceneObject wired to `CreatureDebugTrigger.ts`, exposing Inspector toggles for chase/release plus the auto-cycle demo mode.
6. Base materials (blob + eyes) created via `createAssetFromPreset(presetName: "UnlitMaterialPreset", ...)` through `asset-graphql` at scene-construction time, assigned to `RenderMeshVisual.mainMaterial`. Runtime brighten effects use the Lens API clone pattern (`mat.mainPass.baseColor`/`.emissiveColor`) — never the `passInfos.0.*` GraphQL path at runtime; the two are not interchangeable.
7. No physics components anywhere — direct transform control only.

## Procedural blob mesh

- **Shape**: lathe a sphere-like profile (7–9 `[radius, height]` points, bottom pole → equator bulge → top pole, slight belly-bulge for personality) with `buildLathe(builder, profile, segments=16–20, ...)`. Well under the 5,000–15,000 tri budget even with eyes and headroom for 6 simultaneous creatures later.
- **Vertex layout**: `position(3) + normal(3, normalized) + color(4)`.
- **Breathing pulse (~3%) and squash & stretch**: applied as transform-level scale on `Body` (uniform pulse for breathing, non-uniform axis scale for squash/stretch on direction change) — cheap, and avoids two different mechanisms fighting over the same effect.
- **Organic "wobble"**: a subtler effect reserved for `setVertexInterleaved` — small per-vertex sine offset along each vertex's normal, phase-offset by vertex index, built once at construction (topology fixed) and updated per frame via one batched `builder.updateMesh()` call after all `setVertexInterleaved` calls.
- **Winding order**: verify CCW-from-outside after first build via two preview angles; fix by flipping index order, not by enabling two-sided rendering.
- **Eyes**: two tiny primitives (~30–50 tris each) on the front anchor, small offset, simple dark unlit "pupil" material — no pupil tracking beyond whole-creature glance orientation, keeping the tone minimal and non-monstrous.
- **Readable front**: fixed local `-Z` on `Body` (Lens Studio scene-forward convention). All reorientation (wander-facing, glance, chase) uses the exact `faceDirection` helper:
  ```ts
  function faceDirection(visual: SceneObject, dir: vec3): void {
      const yaw = Math.atan2(dir.x, -dir.z);
      visual.getTransform().setLocalRotation(quat.fromEulerAngles(0, yaw, 0));
  }
  ```
  Never simplify to `atan2(-dir.x, -dir.z)` — that only holds for pure ±Z travel and flips 180° on ±X travel, which wander/glance/chase will all exercise.

## Behavior state machine

Local, presentation-only enum — deliberately not named `BehaviorState` (that name is reserved for CLAUDE.md's future data-derived type):

```ts
enum CreaturePresentationState { IDLE, CHASING, RELEASING }
```

Public API (the seam `AttentionArbiter` and the debug trigger both call):
- `requestChase(): void` — `IDLE → CHASING`, no-op if already `CHASING`/`RELEASING`.
- `endChase(): void` — `CHASING → IDLE`, eased back to idle wander, no snap.
- `release(): void` — one-shot, guarded (see below).

Per-frame behavior (`UpdateEvent`, always `getDeltaTime()`-scaled, never `Date.now()`):
- **IDLE**: breathing pulse (always active across all states); slow wander to a re-picked random point inside the habitat radius, eased with arrival radius + dead zone; squash & stretch on direction change; periodic glance-at-camera (`DelayedCallbackEvent` with jittered interval around a configured range) — orient via `faceDirection`, small eased hop.
- **CHASING**: target = `camera position + forward*chaseDistance(1.1–1.3m) + sideOffset(8–12°)`. Smooth-follow: `alpha = clamp(getDeltaTime()*speed, 0, 1); newPos = current.lerp(target, alpha)`, capped at 0.5 m/s with capped per-frame acceleration, dead-zone gated, hard stop at 1m. Hesitant/cat-like feel via a secondary short-timer that occasionally targets a slight offset point before resuming direct pursuit — not a straight beeline. `faceDirection` keeps front oriented toward travel/camera throughout.
- **RELEASING**: wander/chase `UpdateEvent` logic suspended; fully delegated to `ReleaseEffect`.

## Idempotent release

```ts
private isReleased = false;

release(): void {
  if (this.isReleased) return;
  if (this.state !== CreaturePresentationState.CHASING &&
      this.state !== CreaturePresentationState.IDLE) return;
  this.isReleased = true;
  this.state = CreaturePresentationState.RELEASING;
  ReleaseEffect.play(this.particleAnchor, this.bodyMaterial, RELEASE_DURATION_S, RELEASE_PARTICLE_COUNT);
}
```

Single boolean guard checked before any mutation — repeat calls (double-tap, or a future arbiter re-issuing the call) produce exactly one burst/fade/sound, never overlapping effects, never re-triggering post-fade. Flag is never reset — a released creature's lifecycle ends there; a new task gets a fresh `CreatureBehavior` instance. After the 1.5s effect completes (via `DelayedCallbackEvent`), the `Creature` root SceneObject is disabled (not destroyed), per the resolved decision — the debug trigger gets a "reset" action to re-enable it for repeat testing.

## Release effect

- Brighten: `mat.mainPass.emissiveColor`/`baseColor` boosted via the clone-before-mutate pattern.
- ~30 lightweight unlit particle instances spawned from `ParticleAnchor` (small spheres/quads, prefab-instantiated or built via the same primitive helper at tiny scale), each with slight random horizontal drift, floating upward, opacity eased to 0 over 1.5s, destroyed via `DelayedCallbackEvent.reset(1.5)`. Skips VFX Graph entirely (evaluated and found to be overkill for a 30-particle one-shot) in favor of this manual instantiate/animate/destroy approach.
- Placeholder sound: `release-chime.wav` generated via `build-sfx`, played through an `AudioComponent` (LowLatency mode, since it's a direct-response cue, not ambient).

## Constants — `Assets/Scripts/Config/CreatureConfig.ts`

| Constant | Value / range | Notes |
|---|---|---|
| `HABITAT_RADIUS_MIN_M` / `MAX_M` | 1.0 – 1.5 | habitat zone |
| `CHASE_DISTANCE_MIN_M` / `MAX_M` | 1.1 – 1.3 | chase target distance |
| `CHASE_SIDE_OFFSET_MIN_DEG` / `MAX_DEG` | 8 – 12 | not 30° |
| `CHASE_STOP_DISTANCE_M` | 1.0 | hard stop |
| `MAX_SPEED_MPS` | 0.5 | chase (idle wander capped lower) |
| `MAX_ACCEL_MPS2` | tuned | first-pass tunable |
| `ARRIVAL_RADIUS_M` / `DEAD_ZONE_RADIUS_M` | tuned, small | smooth arrival |
| `BREATHE_AMPLITUDE` | 0.03 | ~3% scale |
| `BREATHE_FREQUENCY_HZ` | tuned, slow | |
| `WOBBLE_AMPLITUDE` / `WOBBLE_FREQUENCY_HZ` | tuned, small | per-vertex organic ripple |
| `WANDER_SPEED_MPS` | ≤ `MAX_SPEED_MPS`, gentler | |
| `SQUASH_STRETCH_AMOUNT` / `_DURATION_S` | tuned | |
| `GLANCE_INTERVAL_MIN_S` / `MAX_S` | tuned, randomized | |
| `GLANCE_HOP_HEIGHT_M` / `_DURATION_S` | tuned, small | |
| `CHASE_HESITATION_INTERVAL_S` | tuned | cat-like pause/dart cadence |
| `LATHE_SEGMENTS` | 16–20 | |
| `BLOB_PROFILE` | `[radius, height][]` | egg/teardrop silhouette |
| `EYE_SIZE_M` / `EYE_OFFSET_M` | tuned, small | |
| `RELEASE_DURATION_S` | 1.5 | spec'd |
| `RELEASE_PARTICLE_COUNT` | 30 | spec'd |
| `RELEASE_PARTICLE_SPEED_MPS` / `_DRIFT_M` | tuned | |
| `RELEASE_BRIGHTEN_AMOUNT` | tuned | |

## Verification

In Lens Studio Preview (preview-only, no hardware-only code):
1. Mesh renders (not invisible/pink) — use the camera-and-rendering invisibility checklist if not.
2. Breathing: smooth ~3% oscillation, continuous.
3. Wander stays within the 1–1.5m habitat — check via `MovePreviewCamera` at a couple of angles.
4. Squash & stretch triggers only on direction change, composes with breathing rather than overwriting it.
5. Eyes/front stay correctly oriented through wander, glance, and chase — deliberately test both Z-dominant and X-dominant travel paths (where the `faceDirection` formula bug would show).
6. Glance: periodic, unforced, reads without text.
7. Chase: via `QueryRuntimeSceneTool`, confirm distance settles at 1.1–1.3m, offset at 8–12°, smooth arrival with no dead-zone oscillation, hard stop at 1m.
8. Chase motion isn't a straight beeline (hesitant cadence visible).
9. Release: brighten + ~30 particles + fade complete at 1.5s; firing `release()` twice in a row produces only one burst (idempotency check, directly testable via the debug trigger).

Tooling: `RunAndCollectLogsTool` after each script edit (catch runtime errors early), `CapturePanelScreenshotTool`/`CaptureRuntimeViewTool` + `MovePreviewCamera` for visual checks, `QueryRuntimeSceneTool` for numeric chase verification, the Inspector debug toggles for firing `requestChase()`/`release()` on demand.

LEAF testing: premature as arbiter-lifecycle testing (no `TaskRecord`/`StateEngine` exist yet — that's CLAUDE.md's later priority). A narrow presentation-contract LEAF scenario (spawn → trigger chase → assert distance/offset envelope within timeout → trigger release → assert inert after ~1.5s → trigger release again → assert no duplicate particle burst) is reasonable to add now since it'll keep working unmodified once a real arbiter calls the same public API — worth writing via `specs-leaf-write-scenarios` once the debug trigger exists, but manual preview verification is sufficient to consider piece 1 done.
