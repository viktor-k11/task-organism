import { forceOpaque } from "./CreatureMaterials";
import {
    BLOB_COLOR,
    READYMADE_PET_HALF_HEIGHT_CM,
    READYMADE_PET_YAW_CORRECTION_DEG,
    DOG_DISPLAY_SCALE,
    CAT_DISPLAY_SCALE,
    OWL_DISPLAY_SCALE,
    ELEPHANT_DISPLAY_SCALE,
    RABBIT_DISPLAY_SCALE,
    PENGUIN_DISPLAY_SCALE,
    VERTEX_SHADING_AMOUNT,
    DISSOLVE_EDGE_GAIN,
    DISSOLVE_DEBUG_AMOUNT,
    DISSOLVE_DEBUG_DIRECTION,
} from "../Config/CreatureConfig";

export type PetSpecies = "dog" | "cat" | "owl" | "elephant" | "rabbit" | "penguin";

/** Species roster indexed by appearanceSeed (see CreatureBehavior.setAppearanceSeed).
 *  Deterministic and stateless in exactly the way the colour palette is: the
 *  same persisted seed always yields the same animal, so a task keeps its
 *  identity across lens restarts without species ever being written to storage.
 *
 *  Grows by one entry per species that passes the acceptance test. Order is
 *  what decides which animals a small demo actually shows, so accepted species
 *  are appended rather than inserted — inserting would re-shuffle every
 *  existing task's animal. */
export const PET_SPECIES_BY_SEED: PetSpecies[] = ["dog", "cat", "owl", "elephant", "rabbit", "penguin"];

/** Height/width scale pair for one behaviour state. Height under 1 squashes;
 *  width above 1 widens to keep the body reading as the same volume. */
export interface PosturePair { height: number; width: number; }
export interface SpeciesPosture { calm: PosturePair; urgent: PosturePair; chase: PosturePair; }

/**
 * PER-SPECIES posture overrides.
 *
 * The global posture values (see ArtDirection / CreatureConfig) were tuned
 * against the original tall procedural blob, where squashing height to 0.86 and
 * widening to 1.14 read as a creature settling. Applied to the ROUND generated
 * species the same numbers read as a creature being stepped on: the penguin
 * flattened into a disc and the rabbit came out squatter than its own model.
 *
 * The reason is proportion, not taste. A squash multiplies the existing
 * silhouette, so the flatter a species already is, the more a fixed height
 * reduction costs it. A tall quadruped has height to spend; an egg does not.
 *
 * Only species that need different numbers appear here. Anything absent — the
 * dog included, deliberately, so its verified look is untouched — falls back to
 * the ArtDirection values, which remain live and editable in the Inspector.
 *
 * KNOWN GAP (flagged for the designer handoff): this table is not yet on the
 * editable surface. Six numbers per species is too many for a flat Inspector
 * panel, so it wants a proper per-species sub-panel rather than 36 more inputs.
 * See HANDOFF-VISUAL.md.
 */
export const PET_POSTURE_OVERRIDES: Partial<Record<PetSpecies, SpeciesPosture>> = {
    // Upright egg with no height to spare — the worst case, so the least squash.
    penguin: {
        calm: { height: 0.96, width: 1.04 },
        urgent: { height: 1.10, width: 0.95 },
        chase: { height: 1.05, width: 0.98 },
    },
    // Round body, and its upright ears exaggerate any vertical compression.
    rabbit: {
        calm: { height: 0.94, width: 1.05 },
        urgent: { height: 1.12, width: 0.94 },
        chase: { height: 1.06, width: 0.97 },
    },
    // Sitting pose: already wide at the base.
    cat: {
        calm: { height: 0.92, width: 1.06 },
        urgent: { height: 1.13, width: 0.94 },
        chase: { height: 1.06, width: 0.97 },
    },
    // Nearly spherical.
    owl: {
        calm: { height: 0.95, width: 1.04 },
        urgent: { height: 1.11, width: 0.95 },
        chase: { height: 1.05, width: 0.98 },
    },
    // Barrel body, wider than tall.
    elephant: {
        calm: { height: 0.94, width: 1.05 },
        urgent: { height: 1.12, width: 0.94 },
        chase: { height: 1.06, width: 0.97 },
    },
};

/** Per-species localScale for the instantiated prefab root. A table rather than
 *  a ternary chain: every species is measured separately (each generation has
 *  its own body-to-bbox ratio, see seat-pet-glb.js), so adding a species should
 *  be adding a row, not editing a conditional. */
export const PET_DISPLAY_SCALE: Record<PetSpecies, number> = {
    dog: DOG_DISPLAY_SCALE,
    cat: CAT_DISPLAY_SCALE,
    owl: OWL_DISPLAY_SCALE,
    elephant: ELEPHANT_DISPLAY_SCALE,
    rabbit: RABBIT_DISPLAY_SCALE,
    penguin: PENGUIN_DISPLAY_SCALE,
};

export function speciesForSeed(seed: number): PetSpecies {
    const n = PET_SPECIES_BY_SEED.length;
    return PET_SPECIES_BY_SEED[((Math.floor(seed) % n) + n) % n];
}

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

        const displayScale = PET_DISPLAY_SCALE[species];
        this.root.getTransform().setLocalPosition(new vec3(0, -READYMADE_PET_HALF_HEIGHT_CM, 0));
        this.root.getTransform().setLocalRotation(quat.fromEulerAngles(0, (READYMADE_PET_YAW_CORRECTION_DEG * Math.PI) / 180, 0));
        this.root.getTransform().setLocalScale(new vec3(displayScale, displayScale, displayScale));

        this.renderMeshVisuals = CreaturePetVisual.findRenderMeshVisuals(this.root);
        if (this.renderMeshVisuals.length === 0) {
            console.error(`[CreaturePetVisual] no RenderMeshVisual found in instantiated ${species} prefab.`);
        }
        this.applyBaseMaterial(baseMaterial);
    }

    /** Removes the instantiated prefab from the scene. Used when a creature's
     *  seed selects a different species than the one already built. */
    destroy(): void {
        this.root.destroy();
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
        // Dissolve channel. Static settings go on every clone; the amount is
        // driven per-creature during release/spawn. Setting the amount here at
        // all is what makes the parameter exist on the material — PetBody.mat
        // carries no entry for it, so an unwritten parameter arrives as 0,
        // which is the shader's no-op.
        // Measured from THIS mesh, not looked up in a table. The meshes are
        // authored at scales two orders of magnitude apart (dog ~205 object
        // units, generated species ~1), and a wrong height makes a creature
        // vanish silently rather than error — which is exactly how five of six
        // disappeared when a single constant was used. Reading the bounds means
        // a seventh species needs no entry anywhere and cannot be forgotten.
        const bounds = this.measureBodyBounds();
        // baseY is not passed: measurement shows every pet mesh is authored
        // feet-at-origin, so the base is 0. One fewer parameter is one fewer
        // thing that can silently fail to be exposed.
        fresh.mainPass.dissolveHeightCm = bounds.height;
        fresh.mainPass.dissolveEdgeGain = DISSOLVE_EDGE_GAIN;
        fresh.mainPass.dissolveDirection = DISSOLVE_DEBUG_AMOUNT >= 0 ? DISSOLVE_DEBUG_DIRECTION : 1;
        fresh.mainPass.dissolveAmount = DISSOLVE_DEBUG_AMOUNT >= 0 ? DISSOLVE_DEBUG_AMOUNT : 0;
        this.assertDissolveParamsLive(fresh, bounds);
        for (const rmv of this.renderMeshVisuals) {
            rmv.mainMaterial = fresh;
        }
    }


    /**
     * Reads the dissolve parameters back off the material and says loudly
     * whether they are live.
     *
     * WHY THIS IS A PRECONDITION AND NOT A DIAGNOSTIC
     * -----------------------------------------------
     * On this platform an intact creature means EITHER "no dissolve is running"
     * OR "the parameter never reached the material" — the two are pixel
     * identical, because the shader's no-op is exactly what an unset parameter
     * produces. That ambiguity has now caused two wrong conclusions, in the same
     * direction, from looking at renders.
     *
     * A parameter becomes a material property some time AFTER the .graphShader
     * reimports (~4s); the gap has been observed at up to two hours with no
     * action taken. So "I wrote it" is not evidence that it is set. Only a
     * readback is.
     *
     * Logged on every run, per creature, so no capture is ever interpreted
     * without knowing whether the parameters were live when it was taken.
     *
     * The height is the discriminator, not baseY: a mesh whose lowest point sits
     * at the origin legitimately has baseY == 0, whereas a height of 0 is always
     * wrong — it is the value an unexposed parameter reports.
     */
    private assertDissolveParamsLive(mat: Material, bounds: { baseY: number; height: number }): void {
        // Bounds logged unconditionally and BEFORE the liveness branch: if the
        // mesh is symmetric about its own origin, baseY is derivable as
        // -height/2 and the parameter can be dropped entirely, which removes
        // one thing that can fail to be exposed.
        console.log(
            `[DissolveBounds] baseY=${bounds.baseY.toFixed(4)} height=${bounds.height.toFixed(4)} ` +
                `symmetric=${Math.abs(bounds.baseY + bounds.height * 0.5) < bounds.height * 0.02}`
        );
        const pass = mat.mainPass;
        const height = pass.dissolveHeightCm;
        const amount = pass.dissolveAmount;

        const missing = typeof height !== "number" || typeof amount !== "number";
        // Compared against what was just written rather than against "> 0", so a
        // stale value from a previous material is caught too.
        const matches = !missing && Math.abs((height as number) - bounds.height) < Math.max(1e-4, bounds.height * 1e-3);

        if (missing) {
            // Names the offender: "undefined" alone cost a whole cycle, because
            // it did not distinguish a parameter that was never exposed from one
            // that had been renamed and lost its exposure.
            const which: string[] = [];
            if (typeof height !== "number") which.push("dissolveHeightCm");
            if (typeof amount !== "number") which.push("dissolveAmount");
            console.log(
                `[DissolveParams] *** NOT LIVE *** undefined: ${which.join(", ")} — these have not become material ` +
                    "properties yet. Any capture taken now shows the NO-OP, not the effect."
            );
            return;
        }
        if (!matches) {
            console.log(
                `[DissolveParams] *** NOT LIVE *** wrote height=${bounds.height.toFixed(4)} but read back ` +
                    `${(height as number).toFixed(4)} — writes are being dropped. Captures are meaningless until this matches.`
            );
            return;
        }
        console.log(
            `[DissolveParams] live height=${(height as number).toFixed(4)} amount=${(amount as number).toFixed(3)}`
        );
    }

    /**
     * The mesh's own object-space vertical extent, from RenderMesh.aabbMin /
     * aabbMax. Returned as {baseY, height} so the shader can express the
     * dissolve sweep as a pure 0..1 fraction of the body at any authoring
     * scale.
     *
     * Falls back to a unit body if no mesh is readable. A unit fallback is the
     * safe direction: it makes the sweep cover the whole creature at once
     * rather than leaving it permanently invisible.
     */
    private measureBodyBounds(): { baseY: number; height: number } {
        let minY = Number.POSITIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;
        for (const rmv of this.renderMeshVisuals) {
            const mesh = rmv.mesh;
            if (!mesh) continue;
            minY = Math.min(minY, mesh.aabbMin.y);
            maxY = Math.max(maxY, mesh.aabbMax.y);
        }
        if (!isFinite(minY) || !isFinite(maxY) || maxY - minY <= 0) {
            console.log("[Dissolve] body bounds unreadable — falling back to a unit body");
            return { baseY: 0, height: 1 };
        }
        return { baseY: minY, height: maxY - minY };
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
