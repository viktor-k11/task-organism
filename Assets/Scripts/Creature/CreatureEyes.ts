import { buildLathe } from "./LatheGeometry";
import { EYE_RADIUS_CM, EYE_COLOR } from "../Config/CreatureConfig";

/**
 * CreatureEyes — builds two tiny low-poly sphere "pupil" meshes on
 * pre-positioned EyeLeft/EyeRight SceneObjects (children of Body, authored
 * by the bootstrap at fixed local offsets on Body's front -Z face).
 *
 * Static geometry — eyes never wobble or animate on their own. They read as
 * a fixed, readable front because they inherit Body's breathing/squash
 * scale and orientation purely by being SceneObject children of Body — no
 * pupil tracking beyond the whole-creature glance orientation (keeps the
 * tone minimal and non-monstrous, per CLAUDE.md).
 */
export class CreatureEyes {
    static build(eyeObject: SceneObject, material: Material | null): RenderMeshVisual {
        const rmv = eyeObject.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
        const builder = new MeshBuilder([
            { name: "position", components: 3 },
            { name: "normal", components: 3, normalized: true },
            { name: "color", components: 4 },
        ]);
        builder.topology = MeshTopology.Triangles;
        builder.indexType = MeshIndexType.UInt16;

        // Small 5-point sphere profile, few segments -> a cheap, simple round pupil.
        const profile: [number, number][] = [
            [0, -EYE_RADIUS_CM],
            [EYE_RADIUS_CM * 0.7, -EYE_RADIUS_CM * 0.5],
            [EYE_RADIUS_CM, 0],
            [EYE_RADIUS_CM * 0.7, EYE_RADIUS_CM * 0.5],
            [0, EYE_RADIUS_CM],
        ];
        buildLathe(builder, profile, 8, EYE_COLOR);

        rmv.mesh = builder.getMesh();
        if (material) {
            rmv.mainMaterial = material;
        }
        builder.updateMesh();
        return rmv;
    }
}
