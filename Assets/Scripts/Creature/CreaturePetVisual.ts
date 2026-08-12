import { forceOpaque } from "./CreatureMaterials";
import {
    BLOB_COLOR,
    READYMADE_PET_HALF_HEIGHT_CM,
    READYMADE_PET_YAW_CORRECTION_DEG,
    DOG_DISPLAY_SCALE,
    CAT_DISPLAY_SCALE,
    VERTEX_SHADING_AMOUNT,
} from "../Config/CreatureConfig";

export type PetSpecies = "dog" | "cat";

/**
 * CreaturePetVisual — wraps one of the ready-made Sketchfab dog/cat GLBs
 * (Assets/3d assets/, see LICENSES.md) as the creature's visual body, an
 * alternative to PetCreatureBody's /build-mesh-generated mesh. Static mesh
 * only: no eyelids/ears/tail parts are attached — those aren't available on
 * a fixed model without building a real animation rig, which is out of
 * scope (see CreatureBehavior's split between "always needed" body
 * orientation and "eye-part-dependent" expression channels — this visual
 * only ever exercises the former).
 *
 * Owns:
 *   - Instantiating the prefab under Body.
 *   - The runtime yaw + scale correction. Both raw GLBs face world +Z by
 *     default (verified empirically with a world-space marker probe) and
 *     needed a 180° yaw correction to match the -Z front convention
 *     faceDirection assumes — same "fix the model, not the helper"
 *     principle as PetCreatureBody, but applied as a fixed wrapper
 *     transform at instantiation time rather than baked into the GLB
 *     bytes: the /build-mesh skill's normalize_glb.js vertex-rewrite
 *     miscomputed scale on these gltf-transform-simplified files (a
 *     --max-dim pass collapsed the AABB to ~0.5cm — verified, not a
 *     guess), so scale/rotation are handled at runtime instead, which is
 *     the wrapper-pattern the skill itself documents as the safe fallback
 *     for the "100x import scale" trap.
 *   - Re-centering so Body's local Y=0 sits at the mesh's vertical center
 *     (matching PetCreatureBody's convention so the untouched habitat/
 *     chase-Y math elsewhere stays correct).
 *   - The same clone-before-mutate opaque unlit material pattern as every
 *     other creature part (per-instance clone so tinting never bleeds
 *     across siblings sharing the same prefab/material asset).
 *
 * Does NOT own: the original fur textures. Both source GLBs ship
 * PBR/lit materials meant to be rendered with scene lighting; this project
 * is unlit-only end to end (CLAUDE.md), and re-wiring a specific albedo
 * texture out of an unknown multi-texture PBR graph into this project's
 * unlit template is significant extra risk for a demo asset. The
 * dog/cat SILHOUETTE (ears, tail, snout, legs, pose) is what actually
 * carries recognizability — confirmed directly: both shapes read
 * unmistakably as "dog" and "cat" even rendered as flat black silhouettes
 * during verification — so this reuses the project's existing solid
 * warm-tint system (BLOB_COLOR, CALM/URGENT/CHASE-tintable) instead.
 */
export class CreaturePetVisual {
    readonly root: SceneObject;
    /** See CreatureVisual.baseOffsetCm (CreatureBehavior.ts) — the prefab root
     *  is placed at local Y = -READYMADE_PET_HALF_HEIGHT_CM (below), which is
     *  exactly the mesh's feet-to-center distance at rest scale. */
    readonly baseOffsetCm: number = READYMADE_PET_HALF_HEIGHT_CM;
    private readonly renderMeshVisuals: RenderMeshVisual[];

    constructor(bodyObject: SceneObject, prefab: ObjectPrefab, species: PetSpecies, baseMaterial: Material) {
        this.root = prefab.instantiate(bodyObject);

        const displayScale = species === "dog" ? DOG_DISPLAY_SCALE : CAT_DISPLAY_SCALE;
        this.root.getTransform().setLocalPosition(new vec3(0, -READYMADE_PET_HALF_HEIGHT_CM, 0));
        this.root.getTransform().setLocalRotation(quat.fromEulerAngles(0, (READYMADE_PET_YAW_CORRECTION_DEG * Math.PI) / 180, 0));
        this.root.getTransform().setLocalScale(new vec3(displayScale, displayScale, displayScale));

        this.renderMeshVisuals = CreaturePetVisual.findRenderMeshVisuals(this.root);
        if (this.renderMeshVisuals.length === 0) {
            console.error(`[CreaturePetVisual] no RenderMeshVisual found in instantiated ${species} prefab.`);
        }
        this.applyBaseMaterial(baseMaterial);
    }

    /** ONE fresh clone-before-mutate per creature, shared across every mesh
     *  part of that creature — called at construction and again from
     *  CreatureBehavior.resetToIdle().
     *
     *  The clone is per-creature (never the shared base asset), so tinting one
     *  creature still cannot bleed onto its siblings. But it is deliberately
     *  ONE clone for all of this creature's parts: updateColorTint mutates a
     *  single material every frame, so giving each part its own clone (as this
     *  did previously) meant a multi-part prefab only ever tinted the part the
     *  renderMeshVisual getter happened to return, leaving the rest stuck at
     *  the base color. That was harmless while every creature shared one
     *  color; it breaks visibly now that color is per-creature identity. */
    applyBaseMaterial(baseMaterial: Material, color?: vec4): void {
        const fresh = baseMaterial.clone();
        fresh.mainPass.baseColor = color ?? new vec4(BLOB_COLOR[0], BLOB_COLOR[1], BLOB_COLOR[2], 1);
        forceOpaque(fresh);
        // These source GLBs' winding/normals aren't verified against this
        // project's back-face-culling convention (see PetCreatureBody's
        // identical fix) — render both sides rather than risk the same
        // "see-through" artifact on an unfamiliar mesh.
        fresh.mainPass.twoSided = true;
        // Enables PetBody.graphShader's multiply of the mesh's baked COLOR_0
        // gradient into baseColor — the shading that makes the body read as a
        // volume. Free at runtime: the gradient is baked into the GLB
        // (Tools/bake-vertex-shading.js), so this is one interpolated vertex
        // attribute and a multiply, no lighting and no extra fetch.
        fresh.mainPass.vertexShadingAmount = VERTEX_SHADING_AMOUNT;
        for (const rmv of this.renderMeshVisuals) {
            rmv.mainMaterial = fresh;
        }
    }

    /** Used for per-frame tinting (see CreatureBehavior.updateColorTint).
     *  Every part of this creature now genuinely shares the single clone
     *  applyBaseMaterial assigned, so mutating this one tints the whole body. */
    get renderMeshVisual(): RenderMeshVisual | null {
        return this.renderMeshVisuals[0] ?? null;
    }

    private static findRenderMeshVisuals(obj: SceneObject): RenderMeshVisual[] {
        const found: RenderMeshVisual[] = [];
        const rmv = obj.getComponent("Component.RenderMeshVisual") as RenderMeshVisual;
        if (rmv) found.push(rmv);
        const count = obj.getChildrenCount();
        for (let i = 0; i < count; i++) {
            found.push(...CreaturePetVisual.findRenderMeshVisuals(obj.getChild(i)));
        }
        return found;
    }
}
