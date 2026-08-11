import { buildLathe } from "./LatheGeometry";

export function buildCreatureShadow(parent: SceneObject, material: Material | null): SceneObject {
    const shadow=global.scene.createSceneObject("ContactShadow"); shadow.setParent(parent);
    // Y matches READYMADE_PET_HALF_HEIGHT_CM (CreatureConfig) — the ready-made
    // dog/cat GLBs' foot level under CreaturePetVisual's recenter convention.
    shadow.getTransform().setLocalPosition(new vec3(-0.5,-17.0,1.8));
    shadow.getTransform().setLocalScale(new vec3(1.3,0.06,0.9));
    const rmv=shadow.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    const builder=new MeshBuilder([{name:"position",components:3},{name:"normal",components:3,normalized:true},{name:"color",components:4}]);
    builder.topology=MeshTopology.Triangles; builder.indexType=MeshIndexType.UInt16;
    buildLathe(builder, [[0,-0.5],[13.5,0],[0,0.5]], 48, [0.06,0.035,0.04,0.3]);
    rmv.mesh=builder.getMesh(); if(material){const m=material.clone();m.mainPass.baseColor=new vec4(0.08,0.05,0.05,0.34);rmv.mainMaterial=m;} builder.updateMesh();
    return shadow;
}
