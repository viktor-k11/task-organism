import { ART } from "../Config/ArtDirection";
import { DISSOLVE_EDGE_GAIN } from "../Config/CreatureConfig";
import { brightenMaterial } from "./CreatureMaterials";


interface ReleaseParticle {
    object: SceneObject;
    velocity: vec3;
}

/**
 * ReleaseEffect — one-shot "release" presentation event: brighten body +
 * eyes, spawn ~30 lightweight unlit particles from ParticleAnchor that
 * drift up and fade over ART.releaseDurationS, and play the one-shot release
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
    /** Pooled objects, built by prewarm() and reused by play(). */
    private pool: SceneObject[] = [];
    private pooledMesh: RenderMesh | null = null;
    private elapsed = 0;
    private particleMaterial: Material | null = null;
    /** The creature's own body material clone, so the dissolve sweep can be
     *  driven per frame. Held rather than re-fetched: brightenMaterial clones
     *  before mutating, so the RenderMeshVisual's material is this instance. */
    private bodyMaterial: Material | null = null;
    private particleBaseColor: vec4 = new vec4(1, 1, 1, 1);
    private updateEvent: UpdateEvent | null = null;
    private cleanupEvent: DelayedCallbackEvent | null = null;
    /** Latches on the first cue so a repeat play() cannot retrigger the sound. */
    private hasPlayedAudio = false;
    /** The creature's visual root, shrunk over the effect as the modern
     *  stand-in for the dissolve melt; scale restored at teardown so a debug
     *  reset() gets an intact creature back. */
    private bodyRoot: SceneObject | null = null;
    private bodyRootScale0: vec3 | null = null;

    /**
     * Builds the particle pool AHEAD of the release, at creature startup.
     *
     * Why: the release frame was measured at 551ms (six creatures), with
     * Visual max 273ms and RenderPass max 292ms — a single frame in which a
     * MeshBuilder ran, uploaded a mesh, and 30 SceneObjects each got created
     * and given a RenderMeshVisual. That is CONSTRUCTION cost, not rendering
     * cost, and it landed exactly on the beat the demo exists to show.
     *
     * Cutting the particle count would have bought frame time by weakening the
     * product's only reward. Pre-allocating buys the same frame time and keeps
     * all 30.
     *
     * The objects are created disabled and parented to the anchor. play() only
     * enables them, resets their transforms and assigns velocities — no
     * allocation, no component creation, no mesh upload.
     */
    prewarm(particleAnchor: SceneObject): void {
        if (this.pool.length > 0) return;
        this.pooledMesh = this.buildParticleMesh(ART.releaseParticleSizeCm * 0.5);
        for (let i = 0; i < ART.releaseParticleCount; i++) {
            const obj = global.scene.createSceneObject("ReleaseParticle");
            obj.setParent(particleAnchor);
            obj.getTransform().setLocalPosition(vec3.zero());
            const rmv = obj.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
            rmv.mesh = this.pooledMesh;
            // Disabled until release — a pooled particle must cost nothing to
            // render while it waits.
            obj.enabled = false;
            this.pool.push(obj);
        }
    }

    play(
        owner: BaseScriptComponent,
        particleAnchor: SceneObject,
        bodyRmv: RenderMeshVisual,
        eyeRmvs: RenderMeshVisual[],
        audio: AudioComponent | null,
        onComplete: () => void,
        bodyRoot: SceneObject | null = null,
    ): void {
        console.log("[ReleaseEffect] play");
        // The textured animated pets have no dissolve channel, so the body
        // SHRINKS over the same duration instead — anchored at the model
        // root, it reads as the creature gently folding away. Runs alongside
        // the dissolve write, which stays a no-op on these materials.
        this.bodyRoot = bodyRoot;
        this.bodyRootScale0 = bodyRoot ? bodyRoot.getTransform().getLocalScale() : null;

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
        const brightBody = brightenMaterial(bodyRmv, ART.releaseBrightenLerp);
        this.bodyMaterial = brightBody;
        // Release sweeps the front upward and eats the body from the bottom.
        brightBody.mainPass.dissolveDirection = 1;
        // Height and base Y are measured per mesh in CreaturePetVisual and are
        // already on this material — deliberately NOT re-set here, because a
        // constant written at release time is what made five of six creatures
        // vanish.
        brightBody.mainPass.dissolveEdgeGain = DISSOLVE_EDGE_GAIN;
        eyeRmvs.forEach((rmv) => brightenMaterial(rmv, ART.releaseBrightenLerp));

        // One shared fading material. Still cloned here rather than at prewarm:
        // the particle colour derives from the creature's BRIGHTENED body, which
        // does not exist until this moment. One clone is cheap; it was the 30
        // object creations and the mesh upload that cost.
        // Textured pet materials may not expose baseColor — warm white keeps
        // the particles alive instead of crashing the release.
        this.particleBaseColor = (brightBody.mainPass.baseColor as vec4 | undefined) ?? new vec4(1, 0.95, 0.8, 1);
        this.particleMaterial = brightBody.clone();
        this.particleMaterial.mainPass.baseColor = this.particleBaseColor;

        // Fall back to building on demand if prewarm never ran, so a caller
        // that forgets it degrades to the old behaviour rather than to no
        // particles at all.
        if (this.pool.length === 0) {
            console.log("[ReleaseEffect] pool MISSING at release — building inline (prewarm did not run)");
            this.prewarm(particleAnchor);
        }
        this.activatePool();
        console.log(`[ReleaseEffect] ${this.particles.length} particles enabled from pool`);

        this.updateEvent = owner.createEvent("UpdateEvent");
        this.updateEvent.bind(() => this.onUpdate());

        this.cleanupEvent = owner.createEvent("DelayedCallbackEvent");
        this.cleanupEvent.bind(() => {
            this.teardown();
            onComplete();
        });
        this.cleanupEvent.reset(ART.releaseDurationS);
    }

    /** Enables pooled particles and gives each a fresh velocity. No allocation
     *  and no component creation happen here — that is the whole point. */
    private activatePool(): void {
        this.particles = [];
        for (const obj of this.pool) {
            const rmv = obj.getComponent("Component.RenderMeshVisual") as RenderMeshVisual;
            if (rmv && this.particleMaterial) rmv.mainMaterial = this.particleMaterial;
            obj.getTransform().setLocalPosition(vec3.zero());
            obj.enabled = true;

            const angle = Math.random() * Math.PI * 2;
            const driftRadius = Math.random() * ART.releaseParticleDriftCm;
            this.particles.push({
                object: obj,
                velocity: new vec3(
                    Math.cos(angle) * driftRadius,
                    ART.releaseParticleSpeedCmS * (0.6 + Math.random() * 0.8),
                    Math.sin(angle) * driftRadius,
                ),
            });
        }
    }

    private teardown(): void {
        // Disable rather than destroy: the pool is reusable, and destroying it
        // would put the construction cost back on the next release.
        for (const p of this.particles) {
            p.object.enabled = false;
        }
        this.particles = [];
        // The owner disables the whole creature right after this, so restoring
        // the shrunk scale is invisible now — but a debug reset() re-enables
        // the same instance and must find it full-sized.
        if (this.bodyRoot && this.bodyRootScale0) {
            this.bodyRoot.getTransform().setLocalScale(this.bodyRootScale0);
            this.bodyRoot = null;
            this.bodyRootScale0 = null;
        }
        if (this.updateEvent) {
            this.updateEvent.enabled = false;
        }
    }

    private onUpdate(): void {
        const dt = getDeltaTime();
        this.elapsed += dt;
        const t = Math.min(1, this.elapsed / ART.releaseDurationS);
        const fadeAlpha = 1 - t;

        for (const p of this.particles) {
            const transform = p.object.getTransform();
            const pos = transform.getLocalPosition();
            transform.setLocalPosition(pos.add(p.velocity.uniformScale(dt)));
        }

        // The dissolve IS the release now: the body is eaten from the bottom
        // up over the same duration the particles drift and fade, so the two
        // read as one event rather than two overlapping ones.
        if (this.bodyMaterial) {
            this.bodyMaterial.mainPass.dissolveAmount = t;
        }
        // Textured pets melt by shrinking instead (no dissolve channel).
        // Ease-in keeps the creature nearly whole while the particles bloom,
        // then lets it slip away in the back half of the effect.
        if (this.bodyRoot && this.bodyRootScale0) {
            const keep = Math.pow(Math.max(0, 1 - t), 1.4);
            const s0 = this.bodyRootScale0;
            this.bodyRoot.getTransform().setLocalScale(new vec3(s0.x * keep, s0.y * keep, s0.z * keep));
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
