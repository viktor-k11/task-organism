import { buildLathe } from "./LatheGeometry";
import {
    MOUTH_SEGMENT_COUNT,
    MOUTH_WIDTH_CM,
    MOUTH_BEAD_RADIUS_CM,
    MOUTH_OFFSET_Y_CM,
    MOUTH_OFFSET_Z_CM,
    MOUTH_CURVE_HEIGHT_CM,
    MOUTH_COLOR,
} from "../Config/CreatureConfig";

interface MouthBead {
    object: SceneObject;
    /** -1..1 across the mouth width, used every frame by updateCurve. */
    normalizedX: number;
}

/**
 * CreatureMouth — optional facial part: a short chain of small overlapping
 * flattened beads (built once, like CreatureEarsAndTail's ears/tail) that
 * reads as a single line. updateCurve() bows the whole chain into a smile
 * (positive) or frown (negative) by offsetting each bead's Y along a
 * symmetric parabola — the same single curve value the whole line reacts
 * to, driven straight from CreatureBehavior's emotionalProfile(). Cheap:
 * per-frame updates are plain position sets, no mesh rebuilding.
 */
export class CreatureMouth {
    private beads: MouthBead[] = [];

    constructor(body: SceneObject, material: Material | null) {
        for (let i = 0; i < MOUTH_SEGMENT_COUNT; i++) {
            const normalizedX = MOUTH_SEGMENT_COUNT === 1 ? 0 : (i / (MOUTH_SEGMENT_COUNT - 1)) * 2 - 1;
            const object = global.scene.createSceneObject(`MouthBead${i}`);
            object.setParent(body);
            object.getTransform().setLocalScale(new vec3(1.0, 0.72, 0.34));

            const rmv = object.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
            const builder = new MeshBuilder([
                { name: "position", components: 3 },
                { name: "normal", components: 3, normalized: true },
                { name: "color", components: 4 },
            ]);
            builder.topology = MeshTopology.Triangles;
            builder.indexType = MeshIndexType.UInt16;
            const r = MOUTH_BEAD_RADIUS_CM;
            buildLathe(builder, [[0, -r], [r * 0.7, -r * 0.6], [r, 0], [r * 0.7, r * 0.6], [0, r]], 16, MOUTH_COLOR);
            rmv.mesh = builder.getMesh();
            if (material) {
                const mat = material.clone();
                mat.mainPass.baseColor = new vec4(MOUTH_COLOR[0], MOUTH_COLOR[1], MOUTH_COLOR[2], MOUTH_COLOR[3]);
                rmv.mainMaterial = mat;
            }
            builder.updateMesh();

            this.beads.push({ object, normalizedX });
        }
    }

    /** curveAmount: positive = smile (ends up, center down), negative = frown. */
    updateCurve(curveAmount: number): void {
        const half = MOUTH_WIDTH_CM / 2;
        for (const bead of this.beads) {
            const x = bead.normalizedX * half;
            const y = MOUTH_OFFSET_Y_CM + curveAmount * MOUTH_CURVE_HEIGHT_CM * (bead.normalizedX * bead.normalizedX - 0.5);
            bead.object.getTransform().setLocalPosition(new vec3(x, y, MOUTH_OFFSET_Z_CM));
        }
    }
}
