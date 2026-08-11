import { buildLathe } from "./LatheGeometry";
import { EYE_RADIUS_CM, EYE_COLOR, BLINK_DURATION_S } from "../Config/CreatureConfig";

export interface CreatureEye {
    root: SceneObject;
    white: RenderMeshVisual;
    pupil: SceneObject;
    pupilVisual: RenderMeshVisual;
    eyelid: SceneObject;
    baseScale: vec3;
    /** This eye's built radius (EYE_RADIUS_CM * sizeScale) — left/right eyes
     *  are built at slightly different sizeScale, so updateExpression's lid
     *  sweep math needs the actual baked radius, not the raw config constant. */
    radius: number;
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
        return { root: eyeObject, white: rmv, pupil, pupilVisual, eyelid, baseScale, radius };
    }

    /**
     * Combines the state-driven resting eyelid closure (0 = wide open, 1 =
     * half-lidded/shut — see CreatureConfig EYELID_*) with the momentary
     * blink reflex via Math.max, so a full blink still fully closes the eye
     * even from a half-lidded CALM resting state. scaleMultiplier widens/
     * narrows the eye on top of its baked-in baseScale (which itself
     * preserves the left/right size asymmetry set at build time).
     */
    static updateExpression(eye: CreatureEye, restingClosure: number, blinkT: number, scaleMultiplier: number): void {
        const blinkClosure = blinkT > 0 ? 1 - Math.abs(blinkT / BLINK_DURATION_S - 0.5) * 2 : 0;
        const closure = Math.max(restingClosure, blinkClosure);
        eye.root.getTransform().setLocalScale(eye.baseScale.uniformScale(scaleMultiplier));

        // The lid's TOP edge stays pinned at the eye's top; its BOTTOM edge
        // sweeps down from the top (closure=0, fully retracted/invisible) to
        // the eye's bottom (closure=1, fully covered) — so it reads as an
        // actual lid closing over the eye, not a fixed-size band that merely
        // repositions (that was the earlier, barely-visible version).
        const r = eye.radius;
        const eyeTop = r;
        const bottomY = r * (1 - 2 * closure);
        const centerY = (eyeTop + bottomY) / 2;
        const halfHeight = Math.max(0.02, (eyeTop - bottomY) / 2);
        eye.eyelid.getTransform().setLocalScale(new vec3(1.04, halfHeight / (r * 1.02), 0.26));
        eye.eyelid.getTransform().setLocalPosition(new vec3(0, centerY, -r * 0.7));
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
