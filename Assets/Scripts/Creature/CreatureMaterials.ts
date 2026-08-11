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
    forceOpaque(mat);
    rmv.clearMaterials();
    rmv.addMaterial(mat);
    return mat;
}

/** Hardens a cloned presentation material against accidental transparency. */
export function forceOpaque(mat: Material): Material {
    const base = mat.mainPass.baseColor as vec4;
    mat.mainPass.baseColor = new vec4(base.x, base.y, base.z, 1);
    // The stock unlit graph exposes its scalar opacity fallback under this
    // generated port name even when the opacity texture define is disabled.
    // Pin both fallbacks so graph evaluation cannot inherit translucent data.
    mat.mainPass.Port_Default_N204 = 1;
    mat.mainPass.Port_Default_N369 = new vec4(1, 1, 1, 1);
    mat.mainPass.blendMode = BlendMode.Disabled;
    mat.mainPass.depthTest = true;
    mat.mainPass.depthWrite = true;
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
