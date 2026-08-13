# CLAD evidence captures

Preview captures taken during the build, rescued from the ephemeral session
scratchpad on 2026-08-13 so they survive in the repository. Every image is a
real Lens Studio Preview frame from the run described, not a mock-up or a
re-staging.

Cycle names refer to headings in [`../../prompts.md`](../../prompts.md).
These are **not yet embedded** into `prompts.md` — that is scheduled for the
Saturday final pass.

All images are ordinary git objects, **not** Git LFS: `.gitattributes` scopes
LFS to `Assets/**` and `Packages/**` only, so a judge cloning without
`git lfs` installed still receives real PNGs here.

---

## The failed graph-shader edit, and how it was isolated

The strongest failure material in the build. Three frames, in order, show a
silent failure being narrowed to its true cause rather than guessed at.

| Image | What it proves |
|---|---|
| `shader-graph-edit-black-bodies.png` | Hand-editing a `Surface Color → Mix → Multiply` chain into the 3067-line `unlit.graphShader` rendered **every creature body black — invisible on the additive display**. The shader compiled with no error; the failure was completely silent. Only the task labels and the demo control remain visible. |
| `shader-graph-edit-black-at-amount-zero.png` | The same scene with the blend amount set to `0`, which makes the inserted chain a mathematical no-op (`mix(white, x, 0) = white`; `baseColor × white = baseColor`). Bodies are **still black** — this ruled out the baked gradient values and the runtime parameter write, because a no-op path cannot darken anything. |
| `shader-reverted-bodies-return.png` | After reverting **only** `unlit.graphShader` via `git checkout`, leaving the baked GLBs in place, the creatures render normally again. This isolated the fault to the graph edit and simultaneously cleared the bake, the GLB re-import and all material-side code. |

Cycle: *Flatness: failed graph-shader edit, then the codeNode route*.
Root cause was never identified — the fix was a change of approach
(Lens Studio's bundled `codeNode.graphShader` + GLSL), not a solve.

---

## Flat cutouts → vertex-shaded volumes

| Image | What it proves |
|---|---|
| `body-flat-unshaded-before.png` | Three creatures at habitat distance with the per-task identity colours working (amber / green / orange from `appearanceSeed`) but **no shading at all** — solid single-colour fills that read as paper cutouts. Also the reference frame for the colour-identity work. |
| `body-vertex-shaded-after.png` | The chaser at close range after the `PetBody.graphShader` codeNode shader multiplied the mesh's baked `COLOR_0` gradient into base colour. Muzzle, ears, eye sockets, chest volume and leg separation are all legible. Costs nothing at runtime: one interpolated vertex attribute and a multiply. |

Cycles: *Per-task colour and movement as state contrast*, *Flatness: failed
graph-shader edit, then the codeNode route*.

---

## Floating creatures → planted on the floor

| Image | What it proves |
|---|---|
| `grounding-floating-before.png` | Colorful Home environment. All three creatures hang **in mid-air in front of a window** — consistent with each other, which is not the same as planted. This frame contradicted a subagent summary that had called them "grounded together at a consistent, plausible surface line". |
| `grounding-planted-after.png` | The same environment after deriving the ground line from eye height (`GROUND_Y_OFFSET_CM = -EYE_HEIGHT_CM`) and having `HabitatFloor` and every creature consume that one value. Feet on the actual carpet, beside the chair legs, at correct scale against the furniture. |

Cycle: *Creatures float after switching Preview environment*.

---

## Habitat pulled onto the furniture by head pitch

| Image | What it proves |
|---|---|
| `habitat-pulled-onto-furniture-before.png` | Creatures sitting on top of the sofa/table rather than the floor. Cause was not the ground constant: `recomputeHabitatOrigin` used the camera's **full 3D forward** as the depth axis, so head pitch scaled habitat distance by `cos(pitch)` — at the ~40° downward angle needed to see floor-level creatures, 240 cm collapsed to 184 cm. The more you looked down at them, the further they climbed onto the furniture. |
| `habitat-on-floor-after.png` | After flattening the forward vector to the horizontal plane in **both** `recomputeHabitatOrigin` and `buildHabitatFloor` (the same projection in both, or the disc and the creatures land at different depths). All three on the carpet past the sofa, contact shadows on the floor, at a true 2.4 m. |

Cycle: *Tremor audit, and the pitch-dependent habitat origin*.

---

## Calm creatures hold still

| Image | What it proves |
|---|---|
| `calm-stillness-t0.png` | Frame at t = 0 of a 20-second observation window after the CALM wander/drift fix (`WANDER_CALM_RADIUS_SCALE` 0.45 → 0, gaze drift 85° → 18°, speed-gated body roll, base-pivot compensation on breathing). |
| `calm-stillness-t20.png` | Frame at t = 20 s of the same window. Silhouettes are positionally stable — same footprint, same contact line, no drift and no bob. |

Cycle: *Calm creatures drift and sway*.

**Honest limitation:** these two frames evidence *positional stillness*, not the
later tremor damping. A still image cannot show a 5.5 Hz oscillation. The tremor
work (`POSTURE_URGENT_TREMOR_AMPLITUDE` 0.045 → 0, `GAZE_URGENT_TREMOR_DEG`
8 → 0, calm breathing 0.06 → 0.018) was proven **numerically** instead, by
sampling `Body.localPosition` through `QueryRuntimeSceneTool`: calm vertical
oscillation fell from 1.76 cm to 0.53 cm peak-to-peak, and the analytical model
predicted the measured values to three decimal places. See the *Tremor audit*
cycle for the channel table.

---

## Cat tail: thin spike → volume

| Image | What it proves |
|---|---|
| `cat-tail-thin-spike-before.png` | The cat's tail rendering as a near-1-pixel vertical spike taller than its head. Measurement showed decimation was **not** the cause — source and decimated cross-sections above y = 0.384 are identical (x-span 0.020 vs 0.019), and decimation kept a *higher* share of tail vertices (51%) than of the model overall (19%). The spike is the source Sketchfab model's own geometry. |
| `cat-tail-thickened-after.png` | After `Tools/reshape-cat-tail.js` thickened the tail 2.4× radially about its own per-slice axis (~1.5 cm → ~3.9 cm) and compressed only the portion above the head to 0.82. Vertex and triangle counts unchanged (3,814 / 5,336) — vertices moved, none added. |

Cycle: *Cat tail — decimation exonerated by measurement*.

---

## The interaction moment

| Image | What it proves |
|---|---|
| `release-hold-progress.png` | The select → resolve beat of the scripted demo story: full task text `Send the project update`, the single `Later` action, and live `HOLD 31%` progress, with the status line reading `holding to let go`. Demonstrates the gesture contract (short pinch selects, separate press-and-hold resolves) and the visible hold feedback required by CLAUDE.md. |

Cycle: *Scripted demo story*.

---

## Not included, and why

- **Timed 20-second sequences** (`final20/`, `story/`) — agent turn latency of
  13–20 s exceeded the beat spacing, so those runs sampled the story unevenly.
  Several frames captured the frozen ending of a previous run rather than the
  beat intended; they are not trustworthy as a timeline and were left out.
- **Environment sweeps** (`ground_env1/2`, `floorfix_evening*`) — superseded by
  the clearer before/after pair above.
- **Staging-panel frames** — a dev control, not evidence of a defect or fix.
- **Audio** — no capture here carries sound. The three release SFX variants in
  `Assets/GeneratedSFX/` must be auditioned directly; cue timing was verified
  from log timestamps (510 ms → 74 ms after moving the trigger ahead of the
  particle work), not from any image.
