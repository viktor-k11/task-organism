import { forceOpaque } from "./CreatureMaterials";
import { BLOB_COLOR, PET_CREATURE_HALF_HEIGHT_CM } from "../Config/CreatureConfig";

/**
 * PetCreatureBody — wraps the /build-mesh-generated head+body+legs GLB
 * (Assets/GeneratedMeshes/PetCreature.glb) as the creature's visual body,
 * replacing the old procedural BlobMeshBuilder lathe egg.
 *
 * Owns: instancing the prefab under Body, re-centering it so Body's local
 * origin sits at the mesh's vertical CENTER (not its feet) — matching the
 * old blob's convention so wanderTargetY / chase-Y / habitat-floor math in
 * CreatureBehavior and TaskOrganismController (out of scope for this
 * change) keeps working unchanged. Also owns giving the mesh a fresh
 * per-instance unlit material (clone-before-mutate, same pattern
 * BlobMeshBuilder used) so per-frame color tinting never bleeds into
 * sibling creatures sharing the same prefab/base material asset.
 *
 * Does NOT own: any per-frame animation. The imported mesh has no
 * per-vertex wobble hook (unlike the old hand-authored lathe) — breathing/
 * posture/tint continue to apply as non-uniform Body-local transform scale
 * only, per the "no rig" constraint.
 */
export class PetCreatureBody {
    readonly root: SceneObject;
    readonly renderMeshVisual: RenderMeshVisual;

    constructor(bodyObject: SceneObject, prefab: ObjectPrefab, baseMaterial: Material) {
        this.root = prefab.instantiate(bodyObject);
        this.root.getTransform().setLocalPosition(new vec3(0, -PET_CREATURE_HALF_HEIGHT_CM, 0));

        const rmv = PetCreatureBody.findRenderMeshVisual(this.root);
        if (!rmv) {
            console.error("[PetCreatureBody] no RenderMeshVisual found in instantiated prefab.");
        }
        this.renderMeshVisual = rmv as RenderMeshVisual;
        this.applyBaseMaterial(baseMaterial);
    }

    /** Fresh per-instance clone-before-mutate — called at construction and again
     *  from CreatureBehavior.resetToIdle() so a released+reset creature never
     *  keeps release()'s brightened clone or another instance's tint. */
    applyBaseMaterial(baseMaterial: Material): void {
        if (!this.renderMeshVisual) return;
        const fresh = baseMaterial.clone();
        fresh.mainPass.baseColor = new vec4(BLOB_COLOR[0], BLOB_COLOR[1], BLOB_COLOR[2], 1);
        forceOpaque(fresh);
        // The /build-mesh AI-generated GLB's winding/normals aren't guaranteed to
        // match this project's back-face-culling convention (BlobBody.mat's
        // cullMode is "Back" — correct for the hand-authored lathe meshes, whose
        // winding is verified in LatheGeometry.ts, but not verified for this
        // imported asset). A cull/winding mismatch reads as "semi-transparent"
        // (background showing through where front faces get wrongly culled),
        // not as an actual alpha-blend issue — depthTest/depthWrite/blendMode
        // above are already correct. Rendering both sides is the safe fix for a
        // single ~2k-triangle mesh at this screen size; not worth re-baking
        // normals for the overdraw cost.
        fresh.mainPass.twoSided = true;
        this.renderMeshVisual.mainMaterial = fresh;
    }

    private static findRenderMeshVisual(obj: SceneObject): RenderMeshVisual | null {
        const rmv = obj.getComponent("Component.RenderMeshVisual") as RenderMeshVisual;
        if (rmv) return rmv;
        const count = obj.getChildrenCount();
        for (let i = 0; i < count; i++) {
            const found = PetCreatureBody.findRenderMeshVisual(obj.getChild(i));
            if (found) return found;
        }
        return null;
    }
}
