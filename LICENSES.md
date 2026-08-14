# Asset licenses

Every binary asset shipped in this repository, and where it came from.

There is exactly **one** third-party asset left: the dog. Every other creature
is generated, and the audio is synthesised from code.

---

## Third-party: the dog

| | |
|---|---|
| **Files** | `Assets/3d assets/dog.glb` (source), `Assets/GeneratedMeshes/dog_lo.glb` (shipped) |
| **Title** | Animated Dog Sits Rolls Over Shake Paw |
| **Author** | LasquetiSpice — https://sketchfab.com/LasquetiSpice |
| **Source** | https://sketchfab.com/3d-models/animated-dog-sits-rolls-over-shake-paw-d9020159339145e6b9ecd5f3d830830f |
| **License** | CC-BY-4.0 — http://creativecommons.org/licenses/by/4.0/ |

Attribution fields are copied verbatim from the GLB's embedded `asset.extras`
metadata (written by Sketchfab's exporter), not retyped by hand.

### Required attribution

> "Animated Dog Sits Rolls Over Shake Paw" by LasquetiSpice, licensed under
> CC-BY-4.0.
> Source: https://sketchfab.com/3d-models/animated-dog-sits-rolls-over-shake-paw-d9020159339145e6b9ecd5f3d830830f

### What we modified

CC-BY-4.0 permits modification and requires that modifications be indicated.
Applied to the dog:

- **Decimated** for the SPECS polycount budget with `@gltf-transform/cli
  simplify` (meshoptimizer). Shipped at 3,672 vertices / 5,002 triangles.
- **Vertex colours baked** by `Tools/bake-vertex-shading.js`, which writes a
  `COLOR_0` attribute the source did not have: a height ramp combined with a
  `normal.y` dome term, used by `Assets/Materials/PetBody.graphShader` to fake
  vertical shading in an unlit pipeline.
- **Textures discarded at runtime.** The source ships PBR materials; this
  project is unlit end to end, so the shipped mesh is rendered with a flat
  per-creature base colour multiplied by the baked vertex shading. The original
  textures are neither used nor redistributed in the runtime material.
- **Orientation and scale corrected at runtime** (not baked): a 180° yaw and a
  uniform display scale applied by `CreaturePetVisual.ts`.

The skeleton and animation clips remain in the file but are unused — the
project drives all motion by direct transform control.

---

## Generated: the other five creatures

Six species ship; five of them are generated. The sixth is the dog above, which
is the project's only third-party asset.

| File | Species |
|---|---|
| `Assets/GeneratedMeshes/cat_lo.glb` | cat |
| `Assets/GeneratedMeshes/owl_lo.glb` | owl |
| `Assets/GeneratedMeshes/elephant_lo.glb` | baby elephant |
| `Assets/GeneratedMeshes/rabbit_lo.glb` | rabbit |
| `Assets/GeneratedMeshes/penguin_lo.glb` | baby penguin |

These were produced with the **SPECS text-to-3D generation API** from prompts
written for this project (recorded in full in `prompts.md`). They are not
derived from any third-party model, so **they carry no third-party rights at
all** — there is no upstream author to credit, no license to comply with, and
no attribution requirement. That is the reason they exist: generating the cat
retired a licensing question rather than documenting one.

Each was then processed by this project's own pipeline, in this order. What each
step actually changes in the file:

| Step | What it modifies |
|---|---|
| `Tools/prepare-pet-glb.js` | Strips skins, animations, and the `JOINTS_0` / `WEIGHTS_0` / `COLOR_0` attributes. Bakes each node's world matrix into `POSITION` and `NORMAL`, then flattens the scene to a single node, so the mesh is self-contained and carries no inherited transform. Rewrites accessor `min`/`max`, which glTF treats as normative. |
| `Tools/seat-pet-glb.js` | Translates every vertex so the mesh's min-Y is exactly 0 — feet at the origin, the convention `CreaturePetVisual` assumes when it seats a prefab. Optionally bakes a 180° yaw by negating X and Z on `POSITION` and `NORMAL`, so facing is a property of the asset rather than a per-species runtime correction. Rewrites accessor `min`/`max` again. Measures but does not alter body height. |
| `Tools/bake-vertex-shading.js` | Adds a `COLOR_0` attribute the generated file does not have: a gamma'd height ramp combined with a `normal.y` dome term, written as normalised unsigned bytes. Reads positions and normals, so it must run last. Skips any primitive that already carries `COLOR_0`. |

None of these steps adds or removes geometry — vertex and triangle counts are
unchanged by all three. The dog goes through `bake-vertex-shading.js` only; it
predates the other two tools and keeps its original node transform and skeleton.

---

## Generated: audio

| File | |
|---|---|
| `Assets/GeneratedSFX/ReleaseBreath.wav` | 1.10 s, stereo |
| `Assets/GeneratedSFX/ReleaseHum.wav` | 1.10 s, stereo |
| `Assets/GeneratedSFX/ReleaseBloom.wav` | 1.10 s, stereo |

Three variants of the task-completion release cue; one is selected by
`RELEASE_SFX_VARIANT`. Synthesised procedurally by the CLAD `build-sfx` DSP
engine — **no samples, no recordings, no datasets, no model weights** — so they
are license-clean by construction and carry no third-party rights.

---

## Removed

Assets deleted from the repository, recorded so their absence is not mistaken
for an oversight:

- **`Assets/3d assets/cat.glb`** — "Bengal Cat Non Commercial" by
  osmanarici2004_1. Removed over an unresolved licence conflict: the model's
  own *title* asserted non-commercial use while its embedded license field said
  CC-BY-4.0, which permits commercial use. Rather than resolve the ambiguity we
  replaced the asset with a generated cat, which removes the question entirely.
- **`Assets/3d assets/cat_quaternius.glb`** — a CC0 replacement candidate,
  never shipped. Rejected because its face was textural rather than geometric:
  its eyes lived in a texture atlas that this project's unlit pipeline
  discards, leaving a blank face.
- **`Assets/GeneratedMeshes/PetCreature.glb`** — an earlier procedurally
  generated body, unreferenced by any code path once the ready-made and
  generated models replaced it.

---

## Verification

To confirm the claim that the dog is the only third-party binary:

```bash
ls "Assets/3d assets/" Assets/GeneratedMeshes/ Assets/GeneratedSFX/
```

Everything under `Assets/GeneratedMeshes/` except `dog_lo.glb` is generated,
everything under `Assets/GeneratedSFX/` is synthesised, and `Assets/3d assets/`
should contain only `dog.glb` and its `.meta`.
