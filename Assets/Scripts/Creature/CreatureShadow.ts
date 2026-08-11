import { buildLathe } from "./LatheGeometry";

export function buildCreatureShadow(parent: SceneObject, material: Material | null): SceneObject {
    const shadow=global.scene.createSceneObject("ContactShadow"); shadow.setParent(parent);
    shadow.getTransform().setLocalPosition(new vec3(0,-8.7,1.2));
    shadow.getTransform().setLocalScale(new vec3(1.0,0.08,0.62));
    const rmv=shadow.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    const builder=new MeshBuilder([{name:"position",components:3},{name:"normal",components:3,normalized:true},{name:"color",components:4}]);
    builder.topology=MeshTopology.Triangles; builder.indexType=MeshIndexType.UInt16;
    buildLathe(builder, [[0,-0.4],[7.2,0],[0,0.4]], 18, [0.08,0.05,0.05,0.34]);
    rmv.mesh=builder.getMesh(); if(material){const m=material.clone();m.mainPass.baseColor=new vec4(0.08,0.05,0.05,0.34);rmv.mainMaterial=m;} builder.updateMesh();
    return shadow;
}
