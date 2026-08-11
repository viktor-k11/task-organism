import { buildLathe } from "./LatheGeometry";
import { EYE_RADIUS_CM, EYE_COLOR, BLINK_DURATION_S } from "../Config/CreatureConfig";

export interface CreatureEye {
    root: SceneObject;
    white: RenderMeshVisual;
    pupil: SceneObject;
    pupilVisual: RenderMeshVisual;
    eyelid: SceneObject;
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

        // Smooth oval white, embedded shallowly into the body's front surface.
        const radius = EYE_RADIUS_CM * sizeScale;
        const profile: [number, number][] = [
            [0,-radius],[radius*0.5,-radius*0.85],[radius*0.82,-radius*0.5],[radius*0.98,-radius*0.15],
            [radius,0],[radius*0.95,radius*0.35],[radius*0.72,radius*0.68],[radius*0.38,radius*0.9],[0,radius],
        ];
        buildLathe(builder, profile, 40, [0.97, 0.90, 0.80, 1]);

        rmv.mesh = builder.getMesh();
        if (whiteMaterial) {
            const white = whiteMaterial.clone();
            white.mainPass.baseColor = new vec4(0.97, 0.90, 0.80, 1);
            rmv.mainMaterial = white;
        }
        builder.updateMesh();

        const pupil = global.scene.createSceneObject("Pupil");
        pupil.setParent(eyeObject);
        pupil.getTransform().setLocalPosition(new vec3(0.18 * sizeScale, -0.08, -radius * 0.98));
        pupil.getTransform().setLocalScale(new vec3(0.68, 0.82, 0.25));
        const pupilVisual = CreatureEyes.buildSphere(pupil, radius * 0.54, pupilMaterial, EYE_COLOR);

        const catchlight = global.scene.createSceneObject("Catchlight"); catchlight.setParent(pupil);
        catchlight.getTransform().setLocalPosition(new vec3(-radius*0.22,radius*0.28,-radius*0.58));
        catchlight.getTransform().setLocalScale(new vec3(0.46,0.46,0.20));
        CreatureEyes.buildSphere(catchlight, radius*0.19, whiteMaterial, [1,0.96,0.9,1]);

        const eyelid = global.scene.createSceneObject("SoftEyelid"); eyelid.setParent(eyeObject);
        eyelid.getTransform().setLocalPosition(new vec3(0, radius*0.94, -radius*0.7));
        eyelid.getTransform().setLocalScale(new vec3(1.04,0.16,0.26));
        CreatureEyes.buildSphere(eyelid, radius*1.02, whiteMaterial, [0.84,0.62,0.49,1]);

        const baseScale = new vec3(1.0, 1.12, 0.46);
        eyeObject.getTransform().setLocalScale(baseScale);
        return { root: eyeObject, white: rmv, pupil, pupilVisual, eyelid, baseScale };
    }

    static updateBlink(eye: CreatureEye, blinkT: number): void {
        const closure = blinkT > 0 ? 1 - Math.abs(blinkT / BLINK_DURATION_S - 0.5) * 2 : 0;
        eye.root.getTransform().setLocalScale(eye.baseScale);
        const lidY = EYE_RADIUS_CM * (0.94 - closure * 0.98);
        eye.eyelid.getTransform().setLocalPosition(new vec3(0, lidY, -EYE_RADIUS_CM * 0.7));
    }

    private static buildSphere(object: SceneObject, radius: number, material: Material | null, color: [number, number, number, number]): RenderMeshVisual {
        const rmv = object.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
        const builder = new MeshBuilder([{ name: "position", components: 3 }, { name: "normal", components: 3, normalized: true }, { name: "color", components: 4 }]);
        builder.topology = MeshTopology.Triangles; builder.indexType = MeshIndexType.UInt16;
        buildLathe(builder, [[0,-radius],[radius*0.38,-radius*0.92],[radius*0.7,-radius*0.7],[radius*0.92,-radius*0.38],[radius,0],[radius*0.92,radius*0.38],[radius*0.7,radius*0.7],[radius*0.38,radius*0.92],[0,radius]], 36, color);
        rmv.mesh = builder.getMesh(); if (material) rmv.mainMaterial = material; builder.updateMesh();
        return rmv;
    }
}
