import { buildLathe } from "./LatheGeometry";

export class CreatureAppendages {
    readonly left: SceneObject;
    readonly right: SceneObject;

    constructor(body: SceneObject, material: Material | null) {
        this.left = this.buildFlipper(body, "FlipperLeft", new vec3(7.0, -2.4, -0.4), -0.62, material);
        this.right = this.buildFlipper(body, "FlipperRight", new vec3(-6.7, -1.8, -0.3), 0.56, material);
    }

    update(timeS: number, speed01: number): void {
        const lag = Math.sin(timeS * 4.2) * (0.10 + speed01 * 0.18);
        this.left.getTransform().setLocalRotation(quat.fromEulerAngles(0, 0, -0.62 - lag));
        this.right.getTransform().setLocalRotation(quat.fromEulerAngles(0, 0, 0.56 + lag * 0.8));
    }

    private buildFlipper(parent: SceneObject, name: string, position: vec3, roll: number, material: Material | null): SceneObject {
        const object = global.scene.createSceneObject(name); object.setParent(parent);
        object.getTransform().setLocalPosition(position);
        object.getTransform().setLocalRotation(quat.fromEulerAngles(0, 0, roll));
        object.getTransform().setLocalScale(new vec3(0.68, 0.9, 0.5));
        const rmv = object.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
        const builder = new MeshBuilder([{name:"position",components:3},{name:"normal",components:3,normalized:true},{name:"color",components:4}]);
        builder.topology=MeshTopology.Triangles; builder.indexType=MeshIndexType.UInt16;
        buildLathe(builder, [[0,-3.4],[1.5,-2.7],[2.25,-1.0],[2.35,0.8],[1.55,2.6],[0,3.5]], 12, [0.91,0.7,0.58,1]);
        rmv.mesh=builder.getMesh(); if(material){const m=material.clone();m.mainPass.baseColor=new vec4(0.91,0.7,0.58,1);rmv.mainMaterial=m;} builder.updateMesh();
        return object;
    }
}
