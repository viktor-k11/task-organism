import { buildLathe } from "./LatheGeometry";

const EAR_COLOR: [number, number, number, number] = [0.78, 0.54, 0.41, 1.0];
const TAIL_COLOR: [number, number, number, number] = [0.84, 0.62, 0.49, 1.0];

/**
 * CreatureEarsAndTail — small pointed ears and a short tail, built as
 * separate SceneObjects (not fused into PetCreatureBody's mesh) so a future
 * animation pass can droop/perk the ears and move the tail independently —
 * per design requirement, these must be separately transformable parts, not
 * baked geometry. Each part's SceneObject origin is its hinge/attachment
 * point on the body, with the mesh extending outward from there, so a
 * future rotation of the object itself reads as a natural droop/perk/wag
 * pivoting from the base.
 *
 * This class only builds the static geometry at rest — no per-frame update
 * method. Wiring droop/perk/wag animation is a separate follow-up pass.
 */
export class CreatureEarsAndTail {
    readonly earLeft: SceneObject;
    readonly earRight: SceneObject;
    readonly tail: SceneObject;

    constructor(body: SceneObject, material: Material | null) {
        this.earLeft = this.buildEar(body, "EarLeft", new vec3(6.5, 15.5, -3.5), -22, material);
        this.earRight = this.buildEar(body, "EarRight", new vec3(-6.5, 15.5, -3.5), 22, material);
        this.tail = this.buildTail(body, new vec3(0, -12.5, 15.5), material);
    }

    private buildEar(parent: SceneObject, name: string, position: vec3, tiltDeg: number, material: Material | null): SceneObject {
        const object = global.scene.createSceneObject(name);
        object.setParent(parent);
        object.getTransform().setLocalPosition(position);
        object.getTransform().setLocalRotation(quat.fromEulerAngles(0.26, 0, (tiltDeg * Math.PI) / 180));

        const rmv = object.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
        const builder = new MeshBuilder([
            { name: "position", components: 3 },
            { name: "normal", components: 3, normalized: true },
            { name: "color", components: 4 },
        ]);
        builder.topology = MeshTopology.Triangles;
        builder.indexType = MeshIndexType.UInt16;
        // Small pointed cone — base at the object's local origin (the hinge).
        buildLathe(builder, [[0, 0], [2.1, 0.4], [2.3, 2.2], [1.3, 4.3], [0, 5.4]], 20, EAR_COLOR);
        rmv.mesh = builder.getMesh();
        if (material) {
            const mat = material.clone();
            mat.mainPass.baseColor = new vec4(EAR_COLOR[0], EAR_COLOR[1], EAR_COLOR[2], EAR_COLOR[3]);
            rmv.mainMaterial = mat;
        }
        builder.updateMesh();
        return object;
    }

    private buildTail(parent: SceneObject, position: vec3, material: Material | null): SceneObject {
        const object = global.scene.createSceneObject("Tail");
        object.setParent(parent);
        object.getTransform().setLocalPosition(position);
        object.getTransform().setLocalRotation(quat.fromEulerAngles((55 * Math.PI) / 180, 0, 0));

        const rmv = object.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
        const builder = new MeshBuilder([
            { name: "position", components: 3 },
            { name: "normal", components: 3, normalized: true },
            { name: "color", components: 4 },
        ]);
        builder.topology = MeshTopology.Triangles;
        builder.indexType = MeshIndexType.UInt16;
        // Tapering tail — base at the object's local origin (the hinge), curving
        // up and back via the rotation above rather than a bent profile.
        buildLathe(builder, [[0, 0], [2.0, 0.6], [2.1, 4.0], [1.6, 7.5], [0.8, 10.0], [0, 11.0]], 20, TAIL_COLOR);
        rmv.mesh = builder.getMesh();
        if (material) {
            const mat = material.clone();
            mat.mainPass.baseColor = new vec4(TAIL_COLOR[0], TAIL_COLOR[1], TAIL_COLOR[2], TAIL_COLOR[3]);
            rmv.mainMaterial = mat;
        }
        builder.updateMesh();
        return object;
    }
}
