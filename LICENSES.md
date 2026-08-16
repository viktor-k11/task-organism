# Asset licenses

Every binary asset shipped in this repository, and where it came from.

Third-party content: **six creature models (all CC-BY-4.0, attributed below)**
and **two open-licensed UI fonts**. Everything else — UI artwork, textures,
audio — is generated or hand-authored for this project and carries no
third-party rights.

---

## Third-party: the six creatures (Sketchfab, CC-BY-4.0)

All six live in `Assets/3d assets/AnimatedPets/`. Attribution fields are
copied verbatim from each GLB's embedded `asset.extras` metadata (written by
Sketchfab's exporter), not retyped by hand, and match the source pages.

| File | Title | Author | Source |
|---|---|---|---|
| `cat_anim.glb` | Toon Cat FREE | [Omabuarts Studio](https://sketchfab.com/omabuarts) | [sketchfab.com/3d-models/toon-cat-free-b2bd1ee7858444bda366110a2d960386](https://sketchfab.com/3d-models/toon-cat-free-b2bd1ee7858444bda366110a2d960386) |
| `dog_anim.glb` | Free Shar Pei Animated Dog | [Artsiom Savelyeu](https://sketchfab.com/artsiom) | [sketchfab.com/3d-models/free-shar-pei-animated-dog-ed151fd59a894b3290d9eee3f716f0bf](https://sketchfab.com/3d-models/free-shar-pei-animated-dog-ed151fd59a894b3290d9eee3f716f0bf) |
| `owl_anim.glb` | Owl - Animated Low Poly | [WildPoly3D](https://sketchfab.com/WildPoly3D) | [sketchfab.com/3d-models/owl-animated-low-poly-48db0c0e608741cf9132312fb61a7430](https://sketchfab.com/3d-models/owl-animated-low-poly-48db0c0e608741cf9132312fb61a7430) |
| `elephant_anim.glb` | Cocofanto Elefanto | [aimodels3d](https://sketchfab.com/aimodels3d) | [sketchfab.com/3d-models/cocofanto-elefanto-8bdd92cd91d144c18550be8e6ff34829](https://sketchfab.com/3d-models/cocofanto-elefanto-8bdd92cd91d144c18550be8e6ff34829) |
| `rabbit_anim.glb` | Rabbit Baby - Animated Low Poly | [WildPoly3D](https://sketchfab.com/WildPoly3D) | [sketchfab.com/3d-models/rabbit-baby-animated-low-poly-936f7b3cfa0e44f482e917b64d4d69ed](https://sketchfab.com/3d-models/rabbit-baby-animated-low-poly-936f7b3cfa0e44f482e917b64d4d69ed) |
| `penguin_anim.glb` | Manchot The Penguin | [A308 Digital](https://sketchfab.com/A308) | [sketchfab.com/3d-models/manchot-the-penguin-9d388e4c095a4c12b690b33a680b599a](https://sketchfab.com/3d-models/manchot-the-penguin-9d388e4c095a4c12b690b33a680b599a) |

**License for all six:** [CC-BY-4.0](http://creativecommons.org/licenses/by/4.0/).

### Required attribution

> "Toon Cat FREE" by Omabuarts Studio, "Free Shar Pei Animated Dog" by Artsiom
> Savelyeu, "Owl - Animated Low Poly" and "Rabbit Baby - Animated Low Poly" by
> WildPoly3D, "Cocofanto Elefanto" by aimodels3d, and "Manchot The Penguin" by
> A308 Digital — all licensed under
> [CC-BY-4.0](http://creativecommons.org/licenses/by/4.0/), via Sketchfab
> (source links above).

### What we modified

CC-BY-4.0 permits modification and requires that modifications be indicated.
Applied uniformly by this project's pipeline (details in `prompts.md`):

- **Decimated for the SPECS polycount budget** with `@gltf-transform/cli`
  (meshoptimizer `simplify`), skeletons, skinning weights and animation clips
  preserved: elephant 19,248 → 3,740 triangles; owl and penguin passed through
  `optimize`/`resize` as well.
- **Textures resized** (penguin and elephant to 1024/512 px) to fit the lens
  size budget. Original texture content otherwise unchanged.
- **Orientation, scale and placement corrected at runtime** (not baked): yaw
  correction, per-instance auto-scale normalization, and feet re-seating by
  `Assets/Scripts/Creature/CreaturePetVisual.ts`.
- **Materials cloned per instance at runtime** so completion effects never
  mutate the shared source materials; the authored textures are used as-is.
- Animation clips are *selected* (idle at rest, walk/waddle while moving) but
  not edited.

---

## Third-party: UI fonts (open licenses)

| File | Family | License |
|---|---|---|
| `Assets/Design assets/Fonts UI/Open Sans.ttf`, `Open Sans Bold.ttf` | Open Sans (via Google Fonts) | [SIL Open Font License 1.1](https://openfontlicense.org/) |
| `Assets/Design assets/Fonts UI/Cousine.ttf`, `Cousine Bold.ttf` | Cousine (via Google Fonts) | [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0) |

An earlier iteration used Segoe UI and Courier New; both are proprietary
Microsoft/Monotype typefaces and were **removed from the repository** and
replaced with the open-licensed families above before submission.

---

## Generated: audio

All eight cues in `Assets/GeneratedSFX/` (`ClosingRitual.wav`,
`FocusAmbience.wav`, `ReleaseBreath.wav`, `ReleaseHum.wav`,
`ReleaseBloom.wav`, `StatePad.wav`, `StateSettle.wav`, `StateStir.wav`) were
synthesised procedurally by the CLAD `build-sfx` / `build-music` DSP engines —
**no samples, no recordings, no datasets, no model weights** — so they are
license-clean by construction. The two ambient beds were later downsampled to
22 kHz mono for lens size.

## Generated / hand-authored: everything else

- `Assets/Generated Textures/` — backdrops generated with the Lens Studio MCP
  texture generation tool from prompts written for this project.
- `Assets/Design assets/*.svg` + their PNGs — window chrome, buttons, species
  icons, sparkle motes: authored as SVG in-session by the agent for this
  project and rasterized via the Lens Studio MCP. No third-party sources.
- `Assets/Materials/`, `Assets/*.graphShader` — authored in-project.

---

## Removed

Assets deleted from the repository, recorded so their absence is not mistaken
for an oversight (full history remains in git):

- **`Assets/GeneratedMeshes/*_lo.glb`** — the six earlier static creature
  bodies (five generated with SPECS text-to-3D, one derived from the CC-BY dog
  below). Superseded by the animated models above and no longer referenced by
  any code path.
- **`Assets/3d assets/dog.glb`** — "Animated Dog Sits Rolls Over Shake Paw" by
  [LasquetiSpice](https://sketchfab.com/LasquetiSpice), CC-BY-4.0
  ([source](https://sketchfab.com/3d-models/animated-dog-sits-rolls-over-shake-paw-d9020159339145e6b9ecd5f3d830830f)).
  Used in earlier builds; superseded by the shar-pei above and removed. Credit
  retained here for the git history in which it appears.
- **`Assets/Sparkles Post Effect.lspkg`** — a Lens Studio Asset Library
  package briefly evaluated for the closing ritual and replaced by this
  project's own generated sparkle textures.
- **Fonts** — Segoe UI (4 files) and Courier New (2 files); see the fonts
  section above.
- **`Assets/3d assets/cat.glb`**, **`cat_quaternius.glb`**,
  **`GeneratedMeshes/PetCreature.glb`** — earlier-phase removals; reasons
  recorded in `prompts.md`.

---

## Verification

To re-check the third-party inventory from a clone:

```bash
ls "Assets/3d assets/AnimatedPets/"        # exactly six CC-BY GLBs (+ .meta)
ls "Assets/Design assets/Fonts UI/"        # Open Sans + Cousine only
python3 - <<'EOF'
import json, struct, glob
for p in sorted(glob.glob('Assets/3d assets/AnimatedPets/*.glb')):
    d = open(p,'rb').read()
    n = struct.unpack('<I', d[12:16])[0]
    e = json.loads(d[20:20+n]).get('asset',{}).get('extras',{})
    print(p, '|', e.get('title'), '|', e.get('author'), '|', e.get('license'))
EOF
```

The embedded metadata printed by that snippet is the license evidence itself.
