import { brightenMaterial } from "./CreatureMaterials";
import {
    RELEASE_DURATION_S,
    RELEASE_PARTICLE_COUNT,
    RELEASE_PARTICLE_SPEED_CM_S,
    RELEASE_PARTICLE_DRIFT_CM,
    RELEASE_PARTICLE_SIZE_CM,
    RELEASE_BRIGHTEN_LERP,
} from "../Config/CreatureConfig";

interface ReleaseParticle {
    object: SceneObject;
    velocity: vec3;
}

/**
 * ReleaseEffect — one-shot "release" presentation event: brighten body +
 * eyes, spawn ~30 lightweight unlit particles from ParticleAnchor that
 * drift up and fade over RELEASE_DURATION_S, play a placeholder chime.
 *
 * Idempotency is CreatureBehavior's job (the isReleased guard) — this class
 * assumes play() is called at most once per instance and does not guard
 * against repeat calls itself.
 *
 * Skips VFX Graph entirely (evaluated and found overkill for a 30-particle
 * one-shot) in favor of manual instantiate/animate/destroy via one shared
 * RenderMesh + one shared fading Material for all particles (cheap: only
 * per-particle transforms differ, not per-particle materials).
 */
export class ReleaseEffect {
    private particles: ReleaseParticle[] = [];
    private elapsed = 0;
    private particleMaterial: Material | null = null;
    private particleBaseColor: vec4 = new vec4(1, 1, 1, 1);
    private updateEvent: UpdateEvent | null = null;
    private cleanupEvent: DelayedCallbackEvent | null = null;

    play(
        owner: BaseScriptComponent,
        particleAnchor: SceneObject,
        bodyRmv: RenderMeshVisual,
        eyeRmvs: RenderMeshVisual[],
        audio: AudioComponent | null,
        onComplete: () => void,
    ): void {
        // Brighten body + eyes (clone-before-mutate, never mutate the shared base material).
        const brightBody = brightenMaterial(bodyRmv, RELEASE_BRIGHTEN_LERP);
        eyeRmvs.forEach((rmv) => brightenMaterial(rmv, RELEASE_BRIGHTEN_LERP));

        // One shared, cheap particle mesh + one shared fading material (reused by all instances).
        const particleMesh = this.buildParticleMesh(RELEASE_PARTICLE_SIZE_CM * 0.5);
        this.particleBaseColor = brightBody.mainPass.baseColor as vec4;
        this.particleMaterial = brightBody.clone();
        this.particleMaterial.mainPass.baseColor = this.particleBaseColor;

        for (let i = 0; i < RELEASE_PARTICLE_COUNT; i++) {
            this.spawnParticle(particleAnchor, particleMesh, this.particleMaterial);
        }

        // Placeholder hook: the AudioComponent is wired and this call site is
        // real, but no track is assigned today (real sound design comes
        // later this week — see CreatureConfig / plan). audioTrack defaults
        // to null, so this is a deliberate silent no-op until a track is
        // assigned, not a missing feature.
        if (audio && audio.audioTrack) {
            audio.playbackMode = Audio.PlaybackMode.LowLatency;
            audio.play(1);
        }

        this.updateEvent = owner.createEvent("UpdateEvent");
        this.updateEvent.bind(() => this.onUpdate());

        this.cleanupEvent = owner.createEvent("DelayedCallbackEvent");
        this.cleanupEvent.bind(() => {
            this.teardown();
            onComplete();
        });
        this.cleanupEvent.reset(RELEASE_DURATION_S);
    }

    private teardown(): void {
        for (const p of this.particles) {
            p.object.destroy();
        }
        this.particles = [];
        if (this.updateEvent) {
            this.updateEvent.enabled = false;
        }
    }

    private spawnParticle(anchor: SceneObject, mesh: RenderMesh, material: Material): void {
        const obj = global.scene.createSceneObject("ReleaseParticle");
        obj.setParent(anchor);
        obj.getTransform().setLocalPosition(vec3.zero());

        const rmv = obj.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
        rmv.mesh = mesh;
        rmv.mainMaterial = material;

        const angle = Math.random() * Math.PI * 2;
        const driftRadius = Math.random() * RELEASE_PARTICLE_DRIFT_CM;
        const velocity = new vec3(
            Math.cos(angle) * driftRadius,
            RELEASE_PARTICLE_SPEED_CM_S * (0.6 + Math.random() * 0.8),
            Math.sin(angle) * driftRadius,
        );

        this.particles.push({ object: obj, velocity });
    }

    private onUpdate(): void {
        const dt = getDeltaTime();
        this.elapsed += dt;
        const t = Math.min(1, this.elapsed / RELEASE_DURATION_S);
        const fadeAlpha = 1 - t;

        for (const p of this.particles) {
            const transform = p.object.getTransform();
            const pos = transform.getLocalPosition();
            transform.setLocalPosition(pos.add(p.velocity.uniformScale(dt)));
        }

        if (this.particleMaterial) {
            const c = this.particleBaseColor;
            this.particleMaterial.mainPass.baseColor = new vec4(c.x, c.y, c.z, c.w * fadeAlpha);
        }
    }

    /** Tiny cube particle (verified CCW winding, adapted from
     *  ls-clad:mesh-builder-scripting references/primitives.md addBox) — built
     *  once per play() and shared across every particle instance. */
    private buildParticleMesh(halfSize: number): RenderMesh {
        const builder = new MeshBuilder([
            { name: "position", components: 3 },
            { name: "normal", components: 3, normalized: true },
            { name: "color", components: 4 },
        ]);
        builder.topology = MeshTopology.Triangles;
        builder.indexType = MeshIndexType.UInt16;

        const color: [number, number, number, number] = [1, 1, 1, 1];
        const indices: number[] = [];
        const hw = halfSize, hh = halfSize, hd = halfSize;
        const x0 = -hw, x1 = hw, y0 = -hh, y1 = hh, z0 = -hd, z1 = hd;
        const verts: number[] = [];
        let vi = 0;

        const face = (
            p0: [number, number, number],
            p1: [number, number, number],
            p2: [number, number, number],
            p3: [number, number, number],
            n: [number, number, number],
        ) => {
            verts.push(
                ...p0, ...n, ...color,
                ...p1, ...n, ...color,
                ...p2, ...n, ...color,
                ...p3, ...n, ...color,
            );
            indices.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
            vi += 4;
        };

        face([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], [1, 0, 0]); // +X
        face([x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0], [-1, 0, 0]); // -X
        face([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [0, 1, 0]); // +Y
        face([x0, y0, z1], [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [0, -1, 0]); // -Y
        face([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]); // +Z
        face([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]); // -Z

        builder.appendVerticesInterleaved(verts);
        builder.appendIndices(indices);
        const mesh = builder.getMesh();
        builder.updateMesh();
        return mesh;
    }
}
