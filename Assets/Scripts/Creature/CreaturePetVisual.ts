import { forceOpaque } from "./CreatureMaterials";
import {
    BLOB_COLOR,
    READYMADE_PET_HALF_HEIGHT_CM,
    READYMADE_PET_TARGET_HEIGHT_CM,
    READYMADE_PET_YAW_CORRECTION_DEG,
    DOG_DISPLAY_SCALE,
    CAT_DISPLAY_SCALE,
    OWL_DISPLAY_SCALE,
    ELEPHANT_DISPLAY_SCALE,
    RABBIT_DISPLAY_SCALE,
    PENGUIN_DISPLAY_SCALE,
    VERTEX_SHADING_AMOUNT,
    DISSOLVE_EDGE_GAIN,
    DISSOLVE_DEBUG_AMOUNT,
    DISSOLVE_DEBUG_DIRECTION,
} from "../Config/CreatureConfig";

export type PetSpecies = "dog" | "cat" | "owl" | "elephant" | "rabbit" | "penguin";

/** Species roster indexed by appearanceSeed (see CreatureBehavior.setAppearanceSeed).
 *  Deterministic and stateless in exactly the way the colour palette is: the
 *  same persisted seed always yields the same animal, so a task keeps its
 *  identity across lens restarts without species ever being written to storage.
 *
 *  Grows by one entry per species that passes the acceptance test. Order is
 *  what decides which animals a small demo actually shows, so accepted species
 *  are appended rather than inserted — inserting would re-shuffle every
 *  existing task's animal. */
export const PET_SPECIES_BY_SEED: PetSpecies[] = ["dog", "cat", "owl", "elephant", "rabbit", "penguin"];

/** Height/width scale pair for one behaviour state. Height under 1 squashes;
 *  width above 1 widens to keep the body reading as the same volume. */
export interface PosturePair { height: number; width: number; }
export interface SpeciesPosture { calm: PosturePair; urgent: PosturePair; chase: PosturePair; }

/**
 * PER-SPECIES posture overrides.
 *
 * The global posture values (see ArtDirection / CreatureConfig) were tuned
 * against the original tall procedural blob, where squashing height to 0.86 and
 * widening to 1.14 read as a creature settling. Applied to the ROUND generated
 * species the same numbers read as a creature being stepped on: the penguin
 * flattened into a disc and the rabbit came out squatter than its own model.
 *
 * The reason is proportion, not taste. A squash multiplies the existing
 * silhouette, so the flatter a species already is, the more a fixed height
 * reduction costs it. A tall quadruped has height to spend; an egg does not.
 *
 * Only species that need different numbers appear here. Anything absent — the
 * dog included, deliberately, so its verified look is untouched — falls back to
 * the ArtDirection values, which remain live and editable in the Inspector.
 *
 * KNOWN GAP (flagged for the designer handoff): this table is not yet on the
 * editable surface. Six numbers per species is too many for a flat Inspector
 * panel, so it wants a proper per-species sub-panel rather than 36 more inputs.
 * See HANDOFF-VISUAL.md.
 */
export const PET_POSTURE_OVERRIDES: Partial<Record<PetSpecies, SpeciesPosture>> = {
    // Upright egg with no height to spare — the worst case, so the least squash.
    penguin: {
        calm: { height: 0.96, width: 1.04 },
        urgent: { height: 1.10, width: 0.95 },
        chase: { height: 1.05, width: 0.98 },
    },
    // Round body, and its upright ears exaggerate any vertical compression.
    rabbit: {
        calm: { height: 0.94, width: 1.05 },
        urgent: { height: 1.12, width: 0.94 },
        chase: { height: 1.06, width: 0.97 },
    },
    // Sitting pose: already wide at the base.
    cat: {
        calm: { height: 0.92, width: 1.06 },
        urgent: { height: 1.13, width: 0.94 },
        chase: { height: 1.06, width: 0.97 },
    },
    // Nearly spherical.
    owl: {
        calm: { height: 0.95, width: 1.04 },
        urgent: { height: 1.11, width: 0.95 },
        chase: { height: 1.05, width: 0.98 },
    },
    // Barrel body, wider than tall.
    elephant: {
        calm: { height: 0.94, width: 1.05 },
        urgent: { height: 1.12, width: 0.94 },
        chase: { height: 1.06, width: 0.97 },
    },
};

/** Per-species localScale for the instantiated prefab root. A table rather than
 *  a ternary chain: every species is measured separately (each generation has
 *  its own body-to-bbox ratio, see seat-pet-glb.js), so adding a species should
 *  be adding a row, not editing a conditional. */
export const PET_DISPLAY_SCALE: Record<PetSpecies, number> = {
    dog: DOG_DISPLAY_SCALE,
    cat: CAT_DISPLAY_SCALE,
    owl: OWL_DISPLAY_SCALE,
    elephant: ELEPHANT_DISPLAY_SCALE,
    rabbit: RABBIT_DISPLAY_SCALE,
    penguin: PENGUIN_DISPLAY_SCALE,
};

export function speciesForSeed(seed: number): PetSpecies {
    const n = PET_SPECIES_BY_SEED.length;
    return PET_SPECIES_BY_SEED[((Math.floor(seed) % n) + n) % n];
}

/**
 * CreaturePetVisual — wraps one of the ready-made Sketchfab dog/cat GLBs
 * (Assets/3d assets/, see LICENSES.md) as the creature's visual body, an
 * alternative to PetCreatureBody's /build-mesh-generated mesh. Static mesh
 * only: no eyelids/ears/tail parts are attached — those aren't available on
 * a fixed model without building a real animation rig, which is out of
 * scope (see CreatureBehavior's split between "always needed" body
 * orientation and "eye-part-dependent" expression channels — this visual
 * only ever exercises the former).
 *
 * Owns:
 *   - Instantiating the prefab under Body.
 *   - The runtime yaw + scale correction. Both raw GLBs face world +Z by
 *     default (verified empirically with a world-space marker probe) and
 *     needed a 180° yaw correction to match the -Z front convention
 *     faceDirection assumes — same "fix the model, not the helper"
 *     principle as PetCreatureBody, but applied as a fixed wrapper
 *     transform at instantiation time rather than baked into the GLB
 *     bytes: the /build-mesh skill's normalize_glb.js vertex-rewrite
 *     miscomputed scale on these gltf-transform-simplified files (a
 *     --max-dim pass collapsed the AABB to ~0.5cm — verified, not a
 *     guess), so scale/rotation are handled at runtime instead, which is
 *     the wrapper-pattern the skill itself documents as the safe fallback
 *     for the "100x import scale" trap.
 *   - Re-centering so Body's local Y=0 sits at the mesh's vertical center
 *     (matching PetCreatureBody's convention so the untouched habitat/
 *     chase-Y math elsewhere stays correct).
 *   - The same clone-before-mutate opaque unlit material pattern as every
 *     other creature part (per-instance clone so tinting never bleeds
 *     across siblings sharing the same prefab/material asset).
 *
 * Does NOT own: the original fur textures. Both source GLBs ship
 * PBR/lit materials meant to be rendered with scene lighting; this project
 * is unlit-only end to end (CLAUDE.md), and re-wiring a specific albedo
 * texture out of an unknown multi-texture PBR graph into this project's
 * unlit template is significant extra risk for a demo asset. The
 * dog/cat SILHOUETTE (ears, tail, snout, legs, pose) is what actually
 * carries recognizability — confirmed directly: both shapes read
 * unmistakably as "dog" and "cat" even rendered as flat black silhouettes
 * during verification — so this reuses the project's existing solid
 * warm-tint system (BLOB_COLOR, CALM/URGENT/CHASE-tintable) instead.
 */
/**
 * Species whose rendered size CANNOT be measured at runtime: rigs built on
 * joint scaling (the eagle owl) render tens of times larger than any AABB
 * the Lens API reports, so auto-normalization silently produces a giant.
 * These get a fixed root scale, calibrated against the editor-side bounds
 * query (owl: rendered 2130cm at scale 4604 → ~28cm at 60, scaled with the
 * roster's +20%).
 */
const MANUAL_ROOT_SCALE: Partial<Record<PetSpecies, number>> = { owl: 72 };

/** How long the looping "frozen pose" sliver of a rest clip runs, seconds.
 *  Long enough for the engine to evaluate a pose, short enough that the
 *  loop's pose delta is invisible — 60ms was long enough to read as a
 *  subtle SHAKE on standing creatures. */
const REST_FREEZE_WINDOW_S = 0.01;

/** One AnimationPlayer's chosen clips + their authored ranges, so the rest
 *  freeze can shrink a clip's window and moving can restore it. */
interface PetAnimationChannel {
    player: AnimationPlayer;
    restName: string;
    moveName: string;
    restBegin: number;
    moveBegin: number;
    moveEnd: number;
}

export class CreaturePetVisual {
    readonly root: SceneObject;
    private channels: PetAnimationChannel[] = [];
    private moving = false;
    private alwaysAnimating = false;
    /** Deferred re-normalize (owl) — armed in setUpAnimation, fires in tick. */
    private lateNormalizeCountdownS = -1;
    private bodyObjectRef: SceneObject;
    private speciesRef: PetSpecies;
    /** See CreatureVisual.baseOffsetCm (CreatureBehavior.ts) — the prefab root
     *  is placed at local Y = -READYMADE_PET_HALF_HEIGHT_CM (below), which is
     *  exactly the mesh's feet-to-center distance at rest scale. */
    readonly baseOffsetCm: number = READYMADE_PET_HALF_HEIGHT_CM;
    private readonly renderMeshVisuals: RenderMeshVisual[];

    constructor(bodyObject: SceneObject, prefab: ObjectPrefab, species: PetSpecies, baseMaterial: Material) {
        this.root = prefab.instantiate(bodyObject);
        this.bodyObjectRef = bodyObject;
        this.speciesRef = species;

        this.root.getTransform().setLocalPosition(new vec3(0, -READYMADE_PET_HALF_HEIGHT_CM, 0));
        this.root.getTransform().setLocalRotation(quat.fromEulerAngles(0, (READYMADE_PET_YAW_CORRECTION_DEG * Math.PI) / 180, 0));
        this.root.getTransform().setLocalScale(vec3.one());

        this.renderMeshVisuals = CreaturePetVisual.findRenderMeshVisuals(this.root);
        if (this.renderMeshVisuals.length === 0) {
            console.error(`[CreaturePetVisual] no RenderMeshVisual found in instantiated ${species} prefab.`);
        }
        // MEASURED, not tabled: the animated GLBs are authored at scales
        // several orders of magnitude apart, so each instance normalizes
        // itself to the shared creature height — except the joint-scale rigs
        // whose bounds lie, which use their calibrated manual scale.
        const manualScale = MANUAL_ROOT_SCALE[species];
        if (manualScale !== undefined) {
            this.root.getTransform().setLocalScale(new vec3(manualScale, manualScale, manualScale));
            console.log(`[AnimatedPet] ${species} manual scale=${manualScale}`);
        } else {
            this.normalizeSize(bodyObject, species);
        }
        this.setUpAnimation(species);
        // All models keep their authored textures; baseMaterial (the old
        // tint/dissolve shader) stays only for the constructor signature.
        void baseMaterial;
        this.adoptSourceMaterials();
    }

    /**
     * These animated GLBs keep their AUTHORED textures — the toon cat is the
     * toon cat, not a solid-color blob. (The old PetBody tint/dissolve shader
     * expects baked COLOR_0 vertex data these meshes don't have; swapping it
     * in rendered visible garbage.) Identity therefore comes from the model,
     * not from a palette tint — supportsTint tells CreatureBehavior to skip
     * its per-frame baseColor writes. Every material is still cloned per
     * instance, so ReleaseEffect's brighten writes never bleed onto siblings
     * of the same species.
     */
    readonly supportsTint = false;

    private adoptSourceMaterials(): void {
        for (const rmv of this.renderMeshVisuals) {
            const count = rmv.getMaterialsCount();
            const clones: Material[] = [];
            for (let i = 0; i < count; i++) {
                const material = rmv.getMaterial(i);
                clones.push(material ? material.clone() : material);
            }
            rmv.clearMaterials();
            for (const clone of clones) if (clone) rmv.addMaterial(clone);
        }
    }

    /**
     * Scales the instantiated model so its bind-pose height equals
     * READYMADE_PET_TARGET_HEIGHT_CM, and re-seats its feet at
     * -READYMADE_PET_HALF_HEIGHT_CM in body space (the same feet-to-center
     * convention every earlier body used, so habitat/chase Y math is
     * untouched). Bounds come from the world AABB right after instantiation
     * — mesh-space AABBs lie about size whenever the GLB carries unit
     * conversions in its node scales, which several of these do.
     */
    private normalizeSize(bodyObject: SceneObject, species: PetSpecies, gentle = false): void {
        let minY = Number.POSITIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;
        for (const rmv of this.renderMeshVisuals) {
            const lo = rmv.worldAabbMin();
            const hi = rmv.worldAabbMax();
            minY = Math.min(minY, lo.y);
            maxY = Math.max(maxY, hi.y);
        }
        const worldHeight = maxY - minY;
        if (!isFinite(worldHeight) || worldHeight <= 0) {
            console.log(`[AnimatedPet] ${species} bounds unreadable — leaving authored scale`);
            return;
        }
        // The body's own world scale (posture squash is ~1 at construction)
        // converts between world cm and body-local cm. Scale-agnostic: works
        // from whatever the root's current scale is, so the deferred re-pass
        // can call it again after the rig has posed the mesh.
        const bodyScaleY = bodyObject.getTransform().getWorldScale().y || 1;
        const currentScale = this.root.getTransform().getLocalScale().x || 1;
        const factor = (READYMADE_PET_TARGET_HEIGHT_CM * bodyScaleY) / worldHeight;
        // The gentle re-pass only corrects models whose bind pose LIED about
        // size (the owl measured ~0cm and blew up room-sized) — a mid-scene
        // 10-20% size pop on an already-correct creature is worse than the
        // small posture-vs-bind measurement error it would fix.
        if (gentle && factor > 0.6 && factor < 1.6) return;
        const scale = currentScale * factor;
        this.root.getTransform().setLocalScale(new vec3(scale, scale, scale));
        // Feet measured relative to the root's own origin at the CURRENT
        // scale (so the offset rescales by `factor`), re-seated to land
        // exactly HALF_HEIGHT below body center.
        const rootWorldY = this.root.getTransform().getWorldPosition().y;
        const feetWorldOffset = minY - rootWorldY;
        const position = this.root.getTransform().getLocalPosition();
        position.y = -READYMADE_PET_HALF_HEIGHT_CM - (feetWorldOffset * factor) / bodyScaleY;
        this.root.getTransform().setLocalPosition(position);
        console.log(
            `[AnimatedPet] ${species} worldH=${worldHeight.toFixed(1)}cm scale=${scale.toFixed(4)} feetWorldOffset=${feetWorldOffset.toFixed(1)}`
        );
    }

    /**
     * Per-frame hook (driven by CreatureBehavior). Its one job: the owl's
     * deferred re-normalization — the constructor measured the EXPLODED bind
     * pose (that model only assembles once its animation is playing), so
     * size and feet are re-measured once, shortly after the rig has posed.
     */
    tick(dt: number): void {
        if (this.lateNormalizeCountdownS < 0) return;
        this.lateNormalizeCountdownS -= dt;
        if (this.lateNormalizeCountdownS > 0) return;
        this.lateNormalizeCountdownS = -1;
        this.normalizeSize(this.bodyObjectRef, this.speciesRef, true);
    }

    /**
     * REST-STILL / MOVE-ANIMATE.
     *
     * Standing creatures hold a frozen pose (a looping sliver at the start
     * of their calmest clip — a real pose, never the bind pose) so they are
     * easy to pinch and hold; the movement clip (walk/waddle/run) plays only
     * while the creature is actually translating (CreatureBehavior measures
     * its own speed and calls setMoving). Clip names are whatever the artist
     * exported, so matching is by substring with a first-clip fallback.
     *
     * THE OWL IS THE EXCEPTION: its mesh parts are exploded in bind pose
     * (eyes and beak authored tens of units apart) and only the playing
     * skeleton assembles them into an owl — freezing it scatters it, so it
     * always animates.
     */
    private setUpAnimation(species: PetSpecies): void {
        const players = CreaturePetVisual.findAnimationPlayers(this.root);
        if (players.length === 0) {
            console.log(`[AnimatedPet] ${species} has no AnimationPlayer — static`);
            return;
        }
        // No current model needs the always-animate escape hatch (the
        // exploded-bind-pose owl that did was replaced); it stays for the
        // next model whose rig only assembles while playing.
        this.alwaysAnimating = false;
        for (const player of players) {
            const names = player.getActiveClips().concat(player.getInactiveClips());
            if (names.length === 0) continue;
            const restName =
                names.find((n) => /idle/i.test(n)) ??
                names.find((n) => /sit|stand|sleep/i.test(n)) ??
                names.find((n) => /scene|take|baselayer/i.test(n)) ??
                names[0];
            const moveName =
                names.find((n) => /walk|waddle|run|fly|move/i.test(n)) ??
                restName;
            const restClip = player.getClip(restName);
            const moveClip = player.getClip(moveName);
            if (!restClip || !moveClip) continue;
            this.channels.push({
                player,
                restName,
                moveName,
                restBegin: restClip.begin,
                moveBegin: moveClip.begin,
                moveEnd: moveClip.end,
            });
            console.log(`[AnimatedPet] ${species} rest="${restName}" move="${moveName}" of [${names.join(" | ")}]`);
        }
        if (this.alwaysAnimating) {
            for (const channel of this.channels) {
                const clip = channel.player.getClip(channel.moveName);
                if (clip) clip.playbackMode = PlaybackMode.Loop;
                channel.player.playClip(channel.moveName);
            }
            this.lateNormalizeCountdownS = 0.5;
            return;
        }
        // Creatures are born standing: force the frozen rest pose.
        this.moving = true;
        this.setMoving(false);
        // Auto-normalized models re-measure once the pose has applied
        // (bind-pose bounds can lie). Manual-scale species skip it — their
        // bounds lie ALWAYS, which is why they are manual.
        if (MANUAL_ROOT_SCALE[this.speciesRef] === undefined) this.lateNormalizeCountdownS = 0.5;
    }

    /**
     * Switches between the frozen rest pose and the looping movement clip.
     * Idempotent per state; driven every frame by CreatureBehavior's speed
     * measurement, so it must be cheap when nothing changes.
     */
    setMoving(moving: boolean): void {
        if (this.alwaysAnimating || moving === this.moving) return;
        this.moving = moving;
        for (const channel of this.channels) {
            channel.player.stopAll();
            const name = moving ? channel.moveName : channel.restName;
            const clip = channel.player.getClip(name);
            if (!clip) continue;
            if (moving) {
                clip.begin = channel.moveBegin;
                clip.end = channel.moveEnd;
            } else {
                // A looping sliver of the rest clip = a held natural pose.
                clip.begin = channel.restBegin;
                clip.end = channel.restBegin + REST_FREEZE_WINDOW_S;
            }
            clip.playbackMode = PlaybackMode.Loop;
            channel.player.playClip(name);
        }
    }

    private static findAnimationPlayers(obj: SceneObject): AnimationPlayer[] {
        const found: AnimationPlayer[] = [];
        const player = obj.getComponent("Component.AnimationPlayer") as AnimationPlayer;
        if (player) found.push(player);
        const count = obj.getChildrenCount();
        for (let i = 0; i < count; i++) {
            found.push(...CreaturePetVisual.findAnimationPlayers(obj.getChild(i)));
        }
        return found;
    }

    /** Removes the instantiated prefab from the scene. Used when a creature's
     *  seed selects a different species than the one already built. */
    destroy(): void {
        this.root.destroy();
    }

    /** Interface obligation only (CreatureBehavior calls this at construction
     *  and resetToIdle). The animated GLBs keep their authored textures — see
     *  adoptSourceMaterials — so there is nothing to (re)apply: swapping the
     *  PetBody tint/dissolve shader onto these meshes rendered garbage (they
     *  carry no baked COLOR_0 gradient), and the tint identity is replaced by
     *  the model's own look. */
    applyBaseMaterial(baseMaterial: Material, color?: vec4): void {
        void baseMaterial;
        void color;
    }


    /**
     * Reads the dissolve parameters back off the material and says loudly
     * whether they are live.
     *
     * WHY THIS IS A PRECONDITION AND NOT A DIAGNOSTIC
     * -----------------------------------------------
     * On this platform an intact creature means EITHER "no dissolve is running"
     * OR "the parameter never reached the material" — the two are pixel
     * identical, because the shader's no-op is exactly what an unset parameter
     * produces. That ambiguity has now caused two wrong conclusions, in the same
     * direction, from looking at renders.
     *
     * A parameter becomes a material property some time AFTER the .graphShader
     * reimports (~4s); the gap has been observed at up to two hours with no
     * action taken. So "I wrote it" is not evidence that it is set. Only a
     * readback is.
     *
     * Logged on every run, per creature, so no capture is ever interpreted
     * without knowing whether the parameters were live when it was taken.
     *
     * The height is the discriminator, not baseY: a mesh whose lowest point sits
     * at the origin legitimately has baseY == 0, whereas a height of 0 is always
     * wrong — it is the value an unexposed parameter reports.
     */
    private assertDissolveParamsLive(mat: Material, bounds: { baseY: number; height: number }): void {
        // Bounds logged unconditionally and BEFORE the liveness branch: if the
        // mesh is symmetric about its own origin, baseY is derivable as
        // -height/2 and the parameter can be dropped entirely, which removes
        // one thing that can fail to be exposed.
        console.log(
            `[DissolveBounds] baseY=${bounds.baseY.toFixed(4)} height=${bounds.height.toFixed(4)} ` +
                `symmetric=${Math.abs(bounds.baseY + bounds.height * 0.5) < bounds.height * 0.02}`
        );
        const pass = mat.mainPass;
        const height = pass.dissolveHeightCm;
        const amount = pass.dissolveAmount;

        const missing = typeof height !== "number" || typeof amount !== "number";
        // Compared against what was just written rather than against "> 0", so a
        // stale value from a previous material is caught too.
        const matches = !missing && Math.abs((height as number) - bounds.height) < Math.max(1e-4, bounds.height * 1e-3);

        if (missing) {
            // Names the offender: "undefined" alone cost a whole cycle, because
            // it did not distinguish a parameter that was never exposed from one
            // that had been renamed and lost its exposure.
            const which: string[] = [];
            if (typeof height !== "number") which.push("dissolveHeightCm");
            if (typeof amount !== "number") which.push("dissolveAmount");
            console.log(
                `[DissolveParams] *** NOT LIVE *** undefined: ${which.join(", ")} — these have not become material ` +
                    "properties yet. Any capture taken now shows the NO-OP, not the effect."
            );
            return;
        }
        if (!matches) {
            console.log(
                `[DissolveParams] *** NOT LIVE *** wrote height=${bounds.height.toFixed(4)} but read back ` +
                    `${(height as number).toFixed(4)} — writes are being dropped. Captures are meaningless until this matches.`
            );
            return;
        }
        console.log(
            `[DissolveParams] live height=${(height as number).toFixed(4)} amount=${(amount as number).toFixed(3)}`
        );
    }

    /**
     * The mesh's own object-space vertical extent, from RenderMesh.aabbMin /
     * aabbMax. Returned as {baseY, height} so the shader can express the
     * dissolve sweep as a pure 0..1 fraction of the body at any authoring
     * scale.
     *
     * Falls back to a unit body if no mesh is readable. A unit fallback is the
     * safe direction: it makes the sweep cover the whole creature at once
     * rather than leaving it permanently invisible.
     */
    private measureBodyBounds(): { baseY: number; height: number } {
        let minY = Number.POSITIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;
        for (const rmv of this.renderMeshVisuals) {
            const mesh = rmv.mesh;
            if (!mesh) continue;
            minY = Math.min(minY, mesh.aabbMin.y);
            maxY = Math.max(maxY, mesh.aabbMax.y);
        }
        if (!isFinite(minY) || !isFinite(maxY) || maxY - minY <= 0) {
            console.log("[Dissolve] body bounds unreadable — falling back to a unit body");
            return { baseY: 0, height: 1 };
        }
        return { baseY: minY, height: maxY - minY };
    }

    /** Used for per-frame tinting (see CreatureBehavior.updateColorTint).
     *  Every part of this creature now genuinely shares the single clone
     *  applyBaseMaterial assigned, so mutating this one tints the whole body. */
    get renderMeshVisual(): RenderMeshVisual | null {
        return this.renderMeshVisuals[0] ?? null;
    }

    private static findRenderMeshVisuals(obj: SceneObject): RenderMeshVisual[] {
        const found: RenderMeshVisual[] = [];
        const rmv = obj.getComponent("Component.RenderMeshVisual") as RenderMeshVisual;
        if (rmv) found.push(rmv);
        const count = obj.getChildrenCount();
        for (let i = 0; i < count; i++) {
            found.push(...CreaturePetVisual.findRenderMeshVisuals(obj.getChild(i)));
        }
        return found;
    }
}
