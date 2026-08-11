# Third-party asset licenses

Ready-made 3D models used as the creature's visual body (`Assets/3d assets/`,
simplified copies at `Assets/GeneratedMeshes/dog_lo.glb` and `cat_lo.glb`).
Attribution fields below are copied verbatim from each GLB's embedded
`asset.extras` metadata (Sketchfab export), not retyped by hand.

## Dog

- **Title:** Animated Dog Sits Rolls Over Shake Paw
- **Author:** LasquetiSpice (https://sketchfab.com/LasquetiSpice)
- **Source:** https://sketchfab.com/3d-models/animated-dog-sits-rolls-over-shake-paw-d9020159339145e6b9ecd5f3d830830f
- **License:** CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)

## Cat

- **Title:** Bengal Cat Non Commercial
- **Author:** osmanarici2004_1 (https://sketchfab.com/osmanarici2004_1)
- **Source:** https://sketchfab.com/3d-models/bengal-cat-non-commercial-ad99670274254e4aa539a90a5dbdb24e
- **License:** CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)

> **Flag, not resolved:** this model's own *title* says "Non Commercial,"
> which directly conflicts with the CC-BY-4.0 value in its embedded license
> field — CC-BY permits commercial use with attribution; NC licenses do not.
> The embedded field is what Sketchfab's exporter wrote at download time, but
> a titled restriction from the author is a real signal it may not reflect
> the author's actual intent. **Before this project — or the cat asset
> specifically — is used anywhere beyond this internal hackathon build,
> verify the license directly on the Sketchfab listing above** rather than
> trusting the embedded metadata alone.

## Attribution text (CC-BY-4.0 requires credit)

> "Animated Dog Sits Rolls Over Shake Paw" by LasquetiSpice, licensed under
> CC-BY-4.0. Source: https://sketchfab.com/3d-models/animated-dog-sits-rolls-over-shake-paw-d9020159339145e6b9ecd5f3d830830f
>
> "Bengal Cat Non Commercial" by osmanarici2004_1, licensed under CC-BY-4.0
> per embedded metadata (see flag above). Source: https://sketchfab.com/3d-models/bengal-cat-non-commercial-ad99670274254e4aa539a90a5dbdb24e

## Processing applied

Both source GLBs were decimated for the SPECS polycount budget using
`@gltf-transform/cli simplify` (meshoptimizer) — see
`Assets/Scripts/Creature/CreaturePetVisual.ts` for the resulting triangle
counts and the runtime orientation/scale correction applied. No other
modification was made to the geometry or textures.
