/**
 * CreatureMaterials — centralizes the runtime clone-before-mutate material
 * pattern (mat.mainPass.baseColor) so the release brighten effect (and any
 * future per-instance tint) doesn't duplicate this logic. Runtime Lens API
 * only — never mix with the passInfos.0.* Editor/GraphQL path (see
 * ls-clad:materials "Editor/GraphQL vs Runtime API").
 */

/**
 * Clones the RenderMeshVisual's current mainMaterial and re-assigns the
 * clone, so subsequent mutations only affect this one instance (materials
 * are shared assets otherwise — see lens-api materials-shaders.md "Golden
 * Rule: Clone Before Modify").
 */
export function cloneMaterialOnto(rmv: RenderMeshVisual): Material {
    const mat = rmv.mainMaterial.clone();
    rmv.clearMaterials();
    rmv.addMaterial(mat);
    return mat;
}

/**
 * Clones rmv's current material and lerps its baseColor toward white by
 * `amount` (0-1). Returns the new clone so the caller can fade it back
 * later if desired.
 */
export function brightenMaterial(rmv: RenderMeshVisual, amount: number): Material {
    const mat = cloneMaterialOnto(rmv);
    const base = mat.mainPass.baseColor as vec4;
    mat.mainPass.baseColor = vec4.lerp(base, new vec4(1, 1, 1, base.w), amount);
    return mat;
}
