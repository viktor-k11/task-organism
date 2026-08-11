import { buildLathe } from "./LatheGeometry";
import { EYE_RADIUS_CM, EYE_COLOR, BLINK_DURATION_S } from "../Config/CreatureConfig";

export interface CreatureEye {
    root: SceneObject;
    white: RenderMeshVisual;
    pupil: SceneObject;
    pupilVisual: RenderMeshVisual;
    baseScale: vec3;
}

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
    static build(eyeObject: SceneObject, whiteMaterial: Material | null, pupilMaterial: Material | null, sizeScale: number): CreatureEye {
        const rmv = eyeObject.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
        const builder = new MeshBuilder([
            { name: "position", components: 3 },
            { name: "normal", components: 3, normalized: true },
            { name: "color", components: 4 },
        ]);
        builder.topology = MeshTopology.Triangles;
        builder.indexType = MeshIndexType.UInt16;

        // Small 5-point sphere profile, few segments -> a cheap, simple round pupil.
        const radius = EYE_RADIUS_CM * sizeScale;
        const profile: [number, number][] = [
            [0, -radius], [radius * 0.75, -radius * 0.5], [radius, 0],
            [radius * 0.75, radius * 0.5], [0, radius],
        ];
        buildLathe(builder, profile, 10, [1, 0.94, 0.84, 1]);

        rmv.mesh = builder.getMesh();
        if (whiteMaterial) {
            const white = whiteMaterial.clone();
            white.mainPass.baseColor = new vec4(1, 0.94, 0.84, 1);
            rmv.mainMaterial = white;
        }
        builder.updateMesh();

        const pupil = global.scene.createSceneObject("Pupil");
        pupil.setParent(eyeObject);
        pupil.getTransform().setLocalPosition(new vec3(0.18 * sizeScale, 0.05, -radius * 0.78));
        pupil.getTransform().setLocalScale(new vec3(0.48, 0.62, 0.32));
        const pupilVisual = CreatureEyes.buildSphere(pupil, radius * 0.72, pupilMaterial, EYE_COLOR);
        const baseScale = new vec3(1, 1.08, 0.72);
        eyeObject.getTransform().setLocalScale(baseScale);
        return { root: eyeObject, white: rmv, pupil, pupilVisual, baseScale };
    }

    static updateBlink(eye: CreatureEye, blinkT: number): void {
        const closed = blinkT > 0 ? Math.max(0.08, Math.abs(blinkT / BLINK_DURATION_S - 0.5) * 2) : 1;
        eye.root.getTransform().setLocalScale(new vec3(eye.baseScale.x, eye.baseScale.y * closed, eye.baseScale.z));
    }

    private static buildSphere(object: SceneObject, radius: number, material: Material | null, color: [number, number, number, number]): RenderMeshVisual {
        const rmv = object.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
        const builder = new MeshBuilder([{ name: "position", components: 3 }, { name: "normal", components: 3, normalized: true }, { name: "color", components: 4 }]);
        builder.topology = MeshTopology.Triangles; builder.indexType = MeshIndexType.UInt16;
        buildLathe(builder, [[0,-radius],[radius*0.78,-radius*0.5],[radius,0],[radius*0.78,radius*0.5],[0,radius]], 12, color);
        rmv.mesh = builder.getMesh(); if (material) rmv.mainMaterial = material; builder.updateMesh();
        return rmv;
    }
}
