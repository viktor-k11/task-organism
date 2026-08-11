import { buildLathe } from "./LatheGeometry";

export class CreatureAppendages {
    readonly left: SceneObject;
    readonly right: SceneObject;

    constructor(body: SceneObject, material: Material | null) {
        this.left = this.buildFlipper(body, "FlipperLeft", new vec3(15.4, -5.2, -0.8), -0.48, material);
        this.right = this.buildFlipper(body, "FlipperRight", new vec3(-15.1, -3.8, -0.5), 0.38, material);
    }

    update(timeS: number, speed01: number): void {
        const lag = Math.sin(timeS * 4.2) * (0.10 + speed01 * 0.18);
        this.left.getTransform().setLocalRotation(quat.fromEulerAngles(0.12, 0.08, -0.48 - lag * 0.45));
        this.right.getTransform().setLocalRotation(quat.fromEulerAngles(-0.08, -0.06, 0.38 + lag * 0.35));
    }

    private buildFlipper(parent: SceneObject, name: string, position: vec3, roll: number, material: Material | null): SceneObject {
        const object = global.scene.createSceneObject(name); object.setParent(parent);
        object.getTransform().setLocalPosition(position);
        object.getTransform().setLocalRotation(quat.fromEulerAngles(0, 0, roll));
        object.getTransform().setLocalScale(new vec3(0.88, 1.0, 0.72));
        const rmv = object.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
        const builder = new MeshBuilder([{name:"position",components:3},{name:"normal",components:3,normalized:true},{name:"color",components:4}]);
        builder.topology=MeshTopology.Triangles; builder.indexType=MeshIndexType.UInt16;
        buildLathe(builder, [[0,-5.4],[1.8,-5.0],[3.0,-3.6],[3.7,-1.5],[3.8,0.8],[3.1,3.0],[1.8,4.8],[0,5.6]], 40, [0.78,0.52,0.42,1]);
        rmv.mesh=builder.getMesh(); if(material){const m=material.clone();m.mainPass.baseColor=new vec4(0.78,0.52,0.42,1);rmv.mainMaterial=m;} builder.updateMesh();
        return object;
    }
}
