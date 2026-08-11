/**
 * LatheGeometry — shared MeshBuilder lathe helper.
 * Owns: revolving a 2D [radius, height] profile around Y into CCW-winding
 *       triangles (adapted from ls-clad:mesh-builder-scripting
 *       references/smooth-surfaces.md buildLathe).
 * Does NOT own: material/color choices, per-frame animation — callers pass
 *       a color and an optional onVertex callback to capture per-vertex
 *       base data (used by BlobMeshBuilder for the organic wobble).
 *
 * Profiles must start and end at radius ~0 (poles) — the side-quad winding
 * degenerates naturally into a fan at each pole, so no separate cap fans
 * are emitted. This is correct for egg/teardrop/sphere-like silhouettes.
 */
export function buildLathe(
    builder: MeshBuilder,
    profile: [number, number, number?][],
    segments: number,
    color: [number, number, number, number],
    onVertex?: (vertexIndex: number, profileIndex: number, pos: vec3, normal: vec3) => void,
): void {
    const P = profile.length;
    let vi = 0;
    const indices: number[] = [];

    // Profile tangent -> outward 2D normal = (dy, -dx), normalized
    const prof2dN: [number, number][] = [];
    for (let j = 0; j < P; j++) {
        const prev = profile[Math.max(0, j - 1)];
        const next = profile[Math.min(P - 1, j + 1)];
        const dx = next[0] - prev[0];
        const dy = next[1] - prev[1];
        const len = Math.hypot(dy, -dx) || 1;
        prof2dN.push([dy / len, -dx / len]);
    }

    // Emit (segments+1) rings x P vertices (duplicated seam for clean normals)
    for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const c = Math.cos(theta);
        const s = Math.sin(theta);
        for (let j = 0; j < P; j++) {
            const [r, y, xOffset = 0] = profile[j];
            const [n2x, n2y] = prof2dN[j];
            const px = r * c + xOffset;
            const py = y;
            const pz = r * s;
            const nx = n2x * c;
            const ny = n2y;
            const nz = n2x * s;
            builder.appendVerticesInterleaved([px, py, pz, nx, ny, nz, ...color]);
            if (onVertex) {
                onVertex(vi, j, new vec3(px, py, pz), new vec3(nx, ny, nz));
            }
            vi++;
        }
    }

    // Side quads — correct winding for a Y-axis lathe (verified: smooth-surfaces.md)
    for (let i = 0; i < segments; i++) {
        for (let j = 0; j < P - 1; j++) {
            const bl = i * P + j;
            const br = i * P + (j + 1);
            const tl = (i + 1) * P + j;
            const tr = (i + 1) * P + (j + 1);
            indices.push(bl, br, tr, bl, tr, tl);
        }
    }

    builder.appendIndices(indices);
}
