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
 * drift up and fade over RELEASE_DURATION_S, and play the one-shot release
 * cue (RELEASE_SFX_VARIANT).
 *
 * Idempotency is primarily CreatureBehavior's job (the isReleased guard).
 * The AUDIO path additionally latches locally via hasPlayedAudio, because a
 * retriggered sound is the one repeat artifact a listener notices instantly;
 * the particle/brighten work is still assumed to run at most once per
 * instance and is not separately guarded.
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
    /** Latches on the first cue so a repeat play() cannot retrigger the sound. */
    private hasPlayedAudio = false;

    play(
        owner: BaseScriptComponent,
        particleAnchor: SceneObject,
        bodyRmv: RenderMeshVisual,
        eyeRmvs: RenderMeshVisual[],
        audio: AudioComponent | null,
        onComplete: () => void,
    ): void {
        console.log("[ReleaseEffect] play");

        // Cue FIRST, before any visual setup. Measured: with this block at the
        // end of play() (after the brighten, the mesh build and 30 particle
        // spawns) the sound started 510ms after the effect began — half the
        // length of the cue itself, and clearly late against the visual.
        // Triggering before that work lands the attack on the same frame the
        // release becomes visible.
        //
        // The track and LowLatency mode are set up once in
        // CreatureBehavior.resolveReleaseAudio; this only triggers.
        //
        // Guarded twice on purpose. CreatureBehavior.release() already
        // early-returns on isReleased, so play() should never be reached
        // twice — but a second audio.play(1) would restart the cue from the
        // top mid-tail, which is the one failure a listener notices
        // immediately. hasPlayedAudio makes a repeat call inaudible even if a
        // future caller loses the outer guard. play(1) = one loop, not looping.
        if (audio && audio.audioTrack && !this.hasPlayedAudio) {
            this.hasPlayedAudio = true;
            audio.play(1);
            console.log("[ReleaseEffect] cue played");
        }

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
