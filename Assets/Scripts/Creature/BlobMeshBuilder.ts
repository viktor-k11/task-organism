import { buildLathe } from "./LatheGeometry";
import {
    BLOB_PROFILE,
    LATHE_SEGMENTS,
    BLOB_COLOR,
    WOBBLE_AMPLITUDE_CM,
    WOBBLE_FREQUENCY_HZ,
    WOBBLE_PHASE_STEP,
} from "../Config/CreatureConfig";

interface BaseVertex {
    pos: vec3;
    normal: vec3;
    profileIndex: number;
}

/**
 * BlobMeshBuilder — procedural lathe-sphere blob geometry.
 * Owns: MeshBuilder construction (egg/teardrop lathe profile, ~16cm tall)
 *       and the per-frame vertex "wobble" ripple (setVertexInterleaved).
 * Does NOT own: transform-level breathing/squash/stretch — CreatureBehavior
 *       applies those directly to the Body SceneObject's transform scale,
 *       so the two mechanisms never fight over the same effect.
 *
 * Plain TS class (not a @component) — instantiated directly by
 * CreatureBehavior against the pre-positioned "Body" child SceneObject the
 * bootstrap authored.
 */
export class BlobMeshBuilder {
    private builder: MeshBuilder;
    private rmv: RenderMeshVisual;
    private baseVerts: BaseVertex[] = [];

    constructor(bodyObject: SceneObject, material: Material | null) {
        this.rmv = bodyObject.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
        this.builder = new MeshBuilder([
            { name: "position", components: 3 },
            { name: "normal", components: 3, normalized: true },
            { name: "color", components: 4 },
        ]);
        this.builder.topology = MeshTopology.Triangles;
        this.builder.indexType = MeshIndexType.UInt16;

        buildLathe(this.builder, BLOB_PROFILE, LATHE_SEGMENTS, BLOB_COLOR, (vertexIndex, profileIndex, pos, normal) => {
            this.baseVerts[vertexIndex] = { pos, normal, profileIndex };
        });

        this.rmv.mesh = this.builder.getMesh();
        if (material) {
            this.rmv.mainMaterial = material;
        }
        this.builder.updateMesh();
    }

    get renderMeshVisual(): RenderMeshVisual {
        return this.rmv;
    }

    /**
     * Per-frame organic ripple — a small sine offset along each vertex's
     * normal, phase-offset by lathe profile ring (height index) so an
     * entire ring at a given height moves together. This keeps the mesh
     * manifold (no pole cracking) while still reading as a subtle
     * top-to-bottom shimmer, distinct from the uniform breathing pulse.
     */
    updateWobble(timeS: number): void {
        const twoPiFreq = WOBBLE_FREQUENCY_HZ * Math.PI * 2;
        for (let i = 0; i < this.baseVerts.length; i++) {
            const bv = this.baseVerts[i];
            const phase = bv.profileIndex * WOBBLE_PHASE_STEP;
            const offset = WOBBLE_AMPLITUDE_CM * Math.sin(timeS * twoPiFreq + phase);
            const px = bv.pos.x + bv.normal.x * offset;
            const py = bv.pos.y + bv.normal.y * offset;
            const pz = bv.pos.z + bv.normal.z * offset;
            this.builder.setVertexInterleaved(i, [
                px, py, pz,
                bv.normal.x, bv.normal.y, bv.normal.z,
                BLOB_COLOR[0], BLOB_COLOR[1], BLOB_COLOR[2], BLOB_COLOR[3],
            ]);
        }
        this.builder.updateMesh();
    }
}
