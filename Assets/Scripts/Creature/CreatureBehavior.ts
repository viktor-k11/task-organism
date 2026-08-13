import { ART } from "../Config/ArtDirection";
import { CreaturePetVisual, PetSpecies, speciesForSeed } from "./CreaturePetVisual";
import { CreatureEyes, CreatureEye } from "./CreatureEyes";
import { CreatureEarsAndTail } from "./CreatureEarsAndTail";
import { CreatureMouth } from "./CreatureMouth";
import { buildCreatureShadow } from "./CreatureShadow";
import { ReleaseEffect } from "./ReleaseEffect";
import { stepSeekArrive, stepSeekArriveAngular, clamp01, findChildByName } from "./CreatureMovement";
import {
    HABITAT_RADIUS_MIN_CM,
    HABITAT_RADIUS_MAX_CM,
    HABITAT_ARC_HALF_ANGLE_DEG,
    HABITAT_VERTICAL_OFFSET_CM,
    HABITAT_HOME_WANDER_RADIUS_CM,
    PRESENTATION_SCALE_EASE_PER_S,
    CHASE_SIDE_OFFSET_MIN_DEG,
    CHASE_SIDE_OFFSET_MAX_DEG,
    MAX_SPEED_CM_S,
    CHASE_MAX_ACCEL_CM_S2,
    CHASE_ARRIVAL_RADIUS_CM,
    CHASE_DEAD_ZONE_RADIUS_CM,
    CHASE_ANGULAR_ARRIVAL_DEG,
    CHASE_ANGULAR_DEAD_ZONE_DEG,
    CHASE_HESITATION_INTERVAL_MIN_S,
    CHASE_HESITATION_INTERVAL_MAX_S,
    CHASE_HESITATION_ANGLE_DEG,
    CHASE_HESITATION_DURATION_S,
    CHASE_LOOK_PAUSE_S,
    CHASE_ANTICIPATION_S,
    CHASE_ANTICIPATION_DIP_CM,
    BREATHE_CALM_FREQUENCY_HZ,
    BREATHE_URGENT_FREQUENCY_HZ,
    BREATHE_CHASE_FREQUENCY_HZ,
    POSTURE_EASE_PER_S,
    POSTURE_URGENT_TREMOR_AMPLITUDE,
    POSTURE_URGENT_TREMOR_HZ,
    GAZE_CALM_YAW_SPEED_DEG_S,
    GAZE_CALM_DRIFT_RANGE_DEG,
    GAZE_CALM_DRIFT_HZ,
    GAZE_URGENT_YAW_SPEED_DEG_S,
    GAZE_URGENT_TREMOR_DEG,
    GAZE_URGENT_TREMOR_HZ,
    TINT_EASE_PER_S,
    TINT_HEAT_COLOR,
    TINT_URGENT_HEAT_BLEND,
    TINT_CHASE_HEAT_BLEND,
    WANDER_CALM_SPEED_CM_S,
    WANDER_CALM_MAX_ACCEL_CM_S2,
    WANDER_CALM_REPICK_PAUSE_MIN_S,
    WANDER_CALM_REPICK_PAUSE_MAX_S,
    WANDER_CALM_RADIUS_SCALE,
    WANDER_URGENT_SPEED_CM_S,
    WANDER_URGENT_MAX_ACCEL_CM_S2,
    WANDER_URGENT_REPICK_PAUSE_MIN_S,
    WANDER_URGENT_REPICK_PAUSE_MAX_S,
    WANDER_URGENT_RADIUS_CM,
    WANDER_ARRIVAL_RADIUS_CM,
    WANDER_DEAD_ZONE_RADIUS_CM,
    WALK_BOB_AMPLITUDE_CM,
    WALK_BOB_HZ_PER_CM_S,
    WALK_BOB_FULL_SPEED_CM_S,
    SQUASH_STRETCH_AMOUNT,
    SQUASH_STRETCH_DURATION_S,
    SQUASH_STRETCH_DIRECTION_DOT_THRESHOLD,
    FACE_TURN_RATE_PER_S,
    CHASE_MAX_YAW_SPEED_DEG_S,
    BODY_MOVE_TILT_DEG,
    BODY_SECONDARY_SWAY_DEG,
    EYE_OFFSET_Y_CM,
    EYE_OFFSET_Z_CM,
    BLINK_INTERVAL_MIN_S,
    BLINK_INTERVAL_MAX_S,
    BLINK_DURATION_S,
    BLOB_COLOR,
    EXPRESSION_EASE_PER_S,
    EYELID_CALM_CLOSURE,
    EYELID_URGENT_CLOSURE,
    EYELID_CHASE_CLOSURE,
    EYE_SCALE_CALM,
    EYE_SCALE_URGENT,
    EYE_SCALE_CHASE,
    EYE_SPACING_CALM_CM,
    EYE_SPACING_URGENT_CM,
    EYE_SPACING_CHASE_CM,
    LEAN_CALM_PITCH_DEG,
    LEAN_URGENT_PITCH_DEG,
    LEAN_CHASE_PITCH_DEG,
    MOUTH_CURVE_CALM,
    MOUTH_CURVE_URGENT,
    MOUTH_CURVE_CHASE,
    GROWTH_SCALE_MAX,
    GROWTH_EASE_PER_S,
    RELEASE_SFX_VARIANT,
    ReleaseSfxVariant,
} from "../Config/CreatureConfig";

/**
 * Pet bodies use their own shader (PetBody.graphShader), not the shared
 * unlit one. It is the same flat unlit output plus one extra step: the mesh's
 * baked COLOR_0 gradient multiplied into baseColor, which is what stops the
 * creatures reading as paper cutouts. Kept as a separate shader/material
 * deliberately — BlobBody/BlobEye and everything else on unlit.graphShader
 * have no vertex colors, and a shader that reads them would render those
 * meshes black on an additive display.
 */
/**
 * All three release variants are loaded so switching RELEASE_SFX_VARIANT is a
 * one-constant change with no code edit. ~190KB each; if that ever matters,
 * drop the two unused entries.
 */
const releaseSfxTracks: Record<ReleaseSfxVariant, AudioTrackAsset> = {
    breath: requireAsset("../../GeneratedSFX/ReleaseBreath.wav") as AudioTrackAsset,
    hum: requireAsset("../../GeneratedSFX/ReleaseHum.wav") as AudioTrackAsset,
    bloom: requireAsset("../../GeneratedSFX/ReleaseBloom.wav") as AudioTrackAsset,
};

const bodyBaseMaterialAsset = requireAsset("../../Materials/PetBody.mat") as Material;
const eyeBaseMaterialAsset = requireAsset("../../Materials/BlobEye.mat") as Material;
/** Ready-made Sketchfab dog/cat GLBs (Assets/3d assets/, see LICENSES.md),
 *  simplified for SPECS — see CreaturePetVisual.ts and CreatureConfig's
 *  READYMADE_PET_* doc comment. */
const dogPrefab = requireAsset("../../GeneratedMeshes/dog_lo.glb") as ObjectPrefab;
const catPrefab = requireAsset("../../GeneratedMeshes/cat_lo.glb") as ObjectPrefab;
const owlPrefab = requireAsset("../../GeneratedMeshes/owl_lo.glb") as ObjectPrefab;
const elephantPrefab = requireAsset("../../GeneratedMeshes/elephant_lo.glb") as ObjectPrefab;
const rabbitPrefab = requireAsset("../../GeneratedMeshes/rabbit_lo.glb") as ObjectPrefab;
const penguinPrefab = requireAsset("../../GeneratedMeshes/penguin_lo.glb") as ObjectPrefab;
/** Species -> prefab. Table rather than a conditional for the same reason as
 *  PET_DISPLAY_SCALE: adding a species should be adding a row. */
const petPrefabs: Record<PetSpecies, ObjectPrefab> = {
    dog: dogPrefab,
    cat: catPrefab,
    owl: owlPrefab,
    elephant: elephantPrefab,
    rabbit: rabbitPrefab,
    penguin: penguinPrefab,
};

/**
 * Local, presentation-only state — deliberately NOT named `BehaviorState`;
 * that name is reserved (per CLAUDE.md) for the future data-derived type
 * computed by StateEngine/AttentionArbiter from TaskRecord + Clock. This
 * enum never touches TaskRecord/repository state — it is driven purely by
 * requestChase()/endChase()/release() calls from whoever owns this creature.
 */
enum CreaturePresentationState {
    IDLE,
    CHASING,
    INTERACTING,
    RELEASING,
}

/**
 * The minimal contract CreatureBehavior needs from whichever visual body
 * implementation is active — currently CreaturePetVisual (ready-made dog/cat
 * GLBs). CreatureBody.ts's PetCreatureBody (the earlier /build-mesh-generated
 * mesh, kept in the repo unused) satisfies the same shape and could be
 * swapped back in by changing only onStart()'s construction call.
 */
interface CreatureVisual {
    readonly renderMeshVisual: RenderMeshVisual | null;
    /**
     * Distance (cm) from Body's local origin DOWN to the mesh's ground-
     * contact point (feet/base), at rest scale. Lets applyBodyScale() scale
     * breathing/posture/squash from that base instead of Body's local
     * origin (the mesh's vertical CENTER) — see applyBodyScale's pivot
     * comment. Without this, any Y-scale channel drags the feet up/down
     * with it (a vertical bob), since scaling around the center moves both
     * the top AND the bottom away from rest.
     */
    readonly baseOffsetCm: number;
    applyBaseMaterial(baseMaterial: Material, color?: vec4): void;
}

/**
 * CreatureBehavior — the one @component for the emotional-core creature.
 *
 * Owns: presentation state (IDLE/CHASING/RELEASING), idle wander + periodic
 *       glance, chase steering (seek-with-arrival, capped accel/speed, hard
 *       stop, hesitation dart), the idempotent release() guard, and the
 *       breathing + squash&stretch transform-level animation on Body.
 * Delegates to plain TS helpers (per the approved plan, to avoid fragile
 *       cross-object @input wiring for a single creature's interior parts):
 *       CreaturePetVisual (the ready-made dog/cat GLB — see LICENSES.md),
 *       CreatureEyes/CreatureEarsAndTail/CreatureMouth (built and wired only
 *       for the earlier procedural/mesh-generated visuals — a static
 *       ready-made mesh has no rig to hang eyelids/ears/tail off, so these
 *       stay unused rather than faking parts that aren't there), ReleaseEffect
 *       (one-shot particle/brighten/sound burst).
 * Public API (the seam a future AttentionArbiter — and the debug trigger —
 *       both call): requestChase(), endChase(), release(), reset().
 * Does NOT own: any TaskRecord/repository/StateEngine knowledge. This piece
 *       is presentation-only, driven entirely by direct method calls — no
 *       task logic yet, per the Piece 1 plan.
 */
@component
export class CreatureBehavior extends BaseScriptComponent {
    @ui.label('<span style="color: #60A5FA;">CreatureBehavior – emotional-core presentation</span>')
    @ui.separator
    @ui.label('<span style="color: #60A5FA;">References</span>')
    @ui.group_start("References")
    @input
    @hint("The scene's main Camera SceneObject — used to compute the habitat center and the chase target.")
    cameraObject!: SceneObject;
    @input
    @hint("Which ready-made model this slot uses: \"dog\" or \"cat\" (see CreaturePetVisual.ts).")
    petSpecies: string = "dog";
    @ui.group_end

    private state: CreaturePresentationState = CreaturePresentationState.IDLE;
    private isReleased = false;

    private bodyObject: SceneObject | null = null;
    private visualRootObject: SceneObject | null = null;
    private shadowObject: SceneObject | null = null;
    private eyeLeftObject: SceneObject | null = null;
    private eyeRightObject: SceneObject | null = null;
    private particleAnchorObject: SceneObject | null = null;
    private audioComponent: AudioComponent | null = null;

    private body: CreatureVisual | null = null;
    /** Same object as `body`, kept at its concrete type so the species swap in
     *  setAppearanceSeed can tear the old prefab down. */
    private petVisual: CreaturePetVisual | null = null;
    private currentSpecies: PetSpecies | null = null;
    /** Set by setAppearanceSeed, which may run before or after onStart — see
     *  the ordering note there. Defaults to 0 so an unseeded creature still
     *  builds a valid species. */
    private appearanceSeed = 0;
    private eyeLeft: CreatureEye | null = null;
    private eyeRight: CreatureEye | null = null;
    private earsAndTail: CreatureEarsAndTail | null = null;
    private mouth: CreatureMouth | null = null;
    private releaseEffect: ReleaseEffect | null = null;

    private timeS = 0;
    private blinkTimer = 0;
    private blinkElapsed = 0;

    // Movement (Creature root world position) + facing (Body local yaw, eased).
    private velocity: vec3 = vec3.zero();
    // vec3.forward() confusingly returns (0,0,1), NOT (0,0,-1) — verified against
    // StudioLib.d.ts. vec3.back() is the one that actually returns (0,0,-1), which
    // is what yaw=0 must resolve to (see faceDirection's convention in
    // CreatureMovement.ts, replicated inline throughout this class). Seeding with
    // the wrong constant meant every fresh/reset creature started rotated 180°
    // from its yaw=0 pose and had to visibly turn itself around over several
    // seconds (worst-case ~10s at CALM's slow turn rate) before gaze logic caught
    // up — this is what read as "the creature faces away from the camera".
    private facingDir: vec3 = vec3.back();

    // Habitat / wander — captured once at spawn/reset so the habitat is a
    // fixed world-space zone, not continuously recentered on the camera.
    private habitatCenter: vec3 = vec3.zero();
    private habitatForwardYaw = 0;
    private homeLateralOffsetCm = 0;
    private homeDepthCm = 0;
    /** Ground/floor Y, camera-relative (cm) — see setHabitatHome's doc and
     *  ART.groundYOffsetCm in CreatureConfig. NOT the mesh's vertical center;
     *  wanderTargetY below is now the literal floor line MovementRoot sits
     *  on, and updatePresentationScale compensates VisualRoot's own local
     *  position so the rendered feet land exactly there (see that method). */
    private homeVerticalOffsetCm = HABITAT_VERTICAL_OFFSET_CM;
    private homeWanderRadiusCm = HABITAT_HOME_WANDER_RADIUS_CM;
    private homeAnchorConfigured = false;
    /** MovementRoot's world Y (ground/floor level, camera-relative) — shared
     *  with HabitatFloor via the same ART.groundYOffsetCm constant, so both
     *  always agree (see recomputeHabitatOrigin). */
    private wanderTargetY = 0;
    private wanderTarget: vec3 | null = null;
    private wanderPauseTimer = 0;
    private isWaitingAtWanderTarget = false;
    private prevMoveDir: vec3 | null = null;

    /**
     * Body's intended local Y position BEFORE the base-pivot compensation
     * applyBodyScale() layers on top (see that method). Normally 0; the
     * chase anticipation dip is the one other channel that wants Body to
     * move on Y, so it writes here instead of calling setLocalPosition
     * directly — applyBodyScale is the single place that actually sets
     * Body's local position each frame, so the dip and the breathing/
     * squash/posture compensation can never clobber each other.
     */
    private bodyRestLocalY = 0;

    /** CALM vs URGENT presentation, driven externally via setUrgent() — see
     *  StateEngine.deriveState. Only read by IDLE wander; CHASING/INTERACTING/
     *  RELEASING are unaffected. */
    private isUrgent = false;

    // Posture (eased non-uniform Body scale) + color tint — see applyBodyScale
    // / updateColorTint. Both keyed off emotionalProfile(), not isUrgent alone.
    private postureHeightScale = 1;
    private postureWidthScale = 1;
    private currentTint: vec4 = new vec4(BLOB_COLOR[0], BLOB_COLOR[1], BLOB_COLOR[2], BLOB_COLOR[3]);
    /** This creature's identity color, chosen from ART.palette by its
     *  task's appearanceSeed (see setAppearanceSeed). Every tint target is
     *  computed relative to THIS, not to a global base, so urgency shifts the
     *  creature's own color rather than overwriting it. Defaults to BLOB_COLOR
     *  so a creature that is never assigned a task still renders sanely. */
    private baseBodyColor: vec4 = new vec4(BLOB_COLOR[0], BLOB_COLOR[1], BLOB_COLOR[2], BLOB_COLOR[3]);
    /** Integrated walk-bob phase (radians). Accumulated rather than derived
     *  from timeS so that cadence changing with speed never snaps the bounce
     *  mid-stride — see applyBodyScale. */
    private walkBobPhase = 0;

    // Expressive face — every channel eased toward the SAME emotionalProfile()
    // target each frame (see updateExpression), so eyelids/eye scale/spacing/
    // lean/mouth can never drift out of sync with each other or with the
    // posture/breathing/tint channels above.
    private eyeLidClosure = EYELID_CALM_CLOSURE;
    private eyeScaleMultiplier = EYE_SCALE_CALM;
    private eyeSpacingCm = EYE_SPACING_CALM_CM;
    private leanPitchDeg = LEAN_CALM_PITCH_DEG;
    private mouthCurve = MOUTH_CURVE_CALM;

    // Chase — polar steering (radius + angle around the camera), decoupled so
    // the radial distance can never dip toward the camera while the angle is
    // still catching up to a target on the far side (see updateChasing).
    private chaseDistanceCm = ART.chaseDistanceMinCm;
    private chaseSideDeg = CHASE_SIDE_OFFSET_MIN_DEG;
    private chaseAngleRad = 0;
    private chaseRadiusCm = ART.chaseDistanceMinCm;
    private chaseAngularVel = 0;
    private chaseRadialVel = 0;
    private hesitationTimer = 0;
    private hesitationAngleOffsetRad = 0;
    private hesitationActiveT = 0;
    private chaseCueElapsed = 0;
    private presentationScale = ART.habitatVisualScale;

    // Whole-body growth (1.0 -> GROWTH_SCALE_MAX as a task ages) — driven
    // externally via setUrgencyLevel01, eased and multiplied into
    // updatePresentationScale's existing habitat/chase scale. Works on any
    // mesh (uniform transform scale), unlike the eye/ear/tail channels above.
    private growthScale = 1.0;
    private targetGrowthScale = 1.0;

    // Squash & stretch envelope: 1 = just triggered, decays to 0.
    private squashEnvelope = 0;

    onAwake(): void {
        this.createEvent("OnStartEvent").bind(() => this.onStart());
        this.createEvent("UpdateEvent").bind(() => this.onUpdate());
    }

    // ── Public API — the seam AttentionArbiter (future) and the debug trigger call ──

    /** Read-only: is this creature currently OUT of the habitat, approaching?
     *  Used by the capacity check to assert invariant 4 (at most one chaser)
     *  from live presentation state rather than from arbiter bookkeeping. */
    isChasing(): boolean {
        return this.state === CreaturePresentationState.CHASING;
    }

    requestChase(): void {
        if (this.isReleased) return;
        if (this.state === CreaturePresentationState.CHASING) return;
        if (this.state === CreaturePresentationState.RELEASING) return;

        this.state = CreaturePresentationState.CHASING;
        this.chaseDistanceCm = this.randomRange(ART.chaseDistanceMinCm, ART.chaseDistanceMaxCm);
        this.chaseSideDeg = this.randomRange(CHASE_SIDE_OFFSET_MIN_DEG, CHASE_SIDE_OFFSET_MAX_DEG) * (Math.random() < 0.5 ? -1 : 1);
        this.hesitationTimer = this.randomRange(CHASE_HESITATION_INTERVAL_MIN_S, CHASE_HESITATION_INTERVAL_MAX_S);
        this.hesitationActiveT = 0;
        this.hesitationAngleOffsetRad = 0;
        this.chaseCueElapsed = 0;

        // Seed polar chase state from the CURRENT position so entering chase
        // never snaps — the angular/radial seek then eases from here.
        if (this.cameraObject) {
            const camPos = this.cameraObject.getTransform().getWorldPosition();
            const curPos = this.sceneObject.getTransform().getWorldPosition();
            const dx = curPos.x - camPos.x;
            const dz = curPos.z - camPos.z;
            const flatDist = Math.sqrt(dx * dx + dz * dz);
            this.chaseRadiusCm = flatDist > 0.0001 ? flatDist : ART.chaseDistanceMinCm;
            this.chaseAngleRad = flatDist > 0.0001 ? Math.atan2(dx, -dz) : 0;
        }
        this.chaseAngularVel = 0;
        this.chaseRadialVel = 0;
        console.log(`[WednesdayEvidence] chase cue look-pause root=${this.sceneObject.name}`);
    }

    /**
     * Picks this creature's identity color from ART.palette using its
     * task's appearanceSeed. Deterministic and stateless: the same seed always
     * yields the same color, so a task looks identical across lens restarts
     * (appearanceSeed is part of the persisted TaskRecord) without any color
     * ever being written to storage itself.
     *
     * Applies immediately rather than waiting for updateColorTint's per-frame
     * ease, so the creature is never visible in the wrong color for a frame.
     */
    setAppearanceSeed(seed: number): void {
        // Remember the seed unconditionally. Script order is by scene hierarchy,
        // and the controller sits ABOVE the creatures, so its onStart (which
        // calls this) runs BEFORE CreatureBehavior.onStart has built any visual.
        // Species is therefore usually resolved later, by onStart reading this
        // field — not here. Colour did not expose the ordering because
        // resetToIdle re-applies the stored tint after the build; species had no
        // such second chance, and every creature silently came out as the
        // seed-0 species.
        this.appearanceSeed = seed;

        // Still handle the already-built case: a seed can change after
        // construction (task rebind), and then the body must be swapped now.
        const species = speciesForSeed(seed);
        if (this.bodyObject && species !== this.currentSpecies) {
            if (this.petVisual) this.petVisual.destroy();
            this.buildSpeciesVisual(species);
        }

        const index = ((Math.floor(seed) % ART.palette.length) + ART.palette.length) % ART.palette.length;
        const c = ART.palette[index];
        this.baseBodyColor = new vec4(c[0], c[1], c[2], c[3]);
        this.currentTint = new vec4(c[0], c[1], c[2], c[3]);
        if (this.body) this.body.applyBaseMaterial(bodyBaseMaterialAsset, this.currentTint);
    }

    /** Instantiates the prefab for one species and records which one is live,
     *  so setAppearanceSeed can tell whether a rebuild is actually needed. */
    private buildSpeciesVisual(species: PetSpecies): void {
        if (!this.bodyObject) return;
        const prefab = petPrefabs[species];
        this.petVisual = new CreaturePetVisual(this.bodyObject, prefab, species, bodyBaseMaterialAsset);
        this.body = this.petVisual;
        this.currentSpecies = species;
    }

    /**
     * Assigns a distinct camera-relative home without changing creature
     * scale or internals. verticalOffsetCm is the GROUND/FLOOR Y (camera-
     * relative, cm) this creature's feet rest on — every caller currently
     * passes the same shared ART.groundYOffsetCm constant (see
     * TaskOrganismController.bindCreatureSlots) so every slot's floor line
     * agrees with HabitatFloor's, but the parameter stays per-creature in
     * case a future caller wants one creature on a raised surface.
     */
    setHabitatHome(lateralOffsetCm: number, depthCm: number, verticalOffsetCm: number, wanderRadiusCm: number): void {
        if (this.isReleased || this.state === CreaturePresentationState.RELEASING) return;
        this.homeLateralOffsetCm = lateralOffsetCm;
        this.homeDepthCm = depthCm;
        this.homeVerticalOffsetCm = verticalOffsetCm;
        this.homeWanderRadiusCm = Math.max(0, wanderRadiusCm);
        this.homeAnchorConfigured = true;
        this.recomputeHabitatOrigin();
        if (this.state === CreaturePresentationState.IDLE) {
            this.wanderTarget = this.pickWanderTarget();
            this.isWaitingAtWanderTarget = false;
            // Same rationale as resetToIdle's snap: this runs during spawn
            // binding (bindCreatureSlots), after resetToIdle has already placed
            // the creature at its pre-home position, so without this it would
            // walk from there to its assigned slot in view of the user.
            this.sceneObject.getTransform().setWorldPosition(this.wanderTarget);
            this.velocity = vec3.zero();
        }
    }

    /**
     * Sets the CALM/URGENT presentation flag — purely a motion-tuning input
     * for IDLE wander (speed/pause/retarget-frequency), read every frame from
     * updateWander/pickWanderTarget. Never changes CreaturePresentationState
     * itself: an URGENT task that becomes the chaser still transitions via
     * requestChase() as before, and this flag is simply ignored while chasing.
     */
    setUrgent(isUrgent: boolean): void {
        this.isUrgent = isUrgent;
    }

    /**
     * Sets the continuous whole-body growth target from the task's raw
     * urgency value (StateEngine.urgency(task) — 0 at creation, reaching
     * CHASE_THRESHOLD's 1.0 when it would become eligible to chase, and
     * beyond if never resolved). Maps [0,1] -> [1.0, GROWTH_SCALE_MAX] and
     * clamps, so an old-but-not-yet-urgent task keeps growing right up to
     * the same threshold the CALM/URGENT channels key off, then holds — an
     * ignored task literally growing, independent of mesh/rig availability.
     */
    setUrgencyLevel01(urgency: number): void {
        this.targetGrowthScale = 1.0 + (GROWTH_SCALE_MAX - 1.0) * clamp01(urgency);
    }

    /** Stops chase translation at the current reacquirable pose; vitality keeps updating. */
    holdForInteraction(): void {
        if (this.isReleased || this.state !== CreaturePresentationState.CHASING) return;
        this.state = CreaturePresentationState.INTERACTING;
        this.velocity = vec3.zero();
        this.chaseAngularVel = 0;
        this.chaseRadialVel = 0;
        this.chaseCueElapsed = 0;
        this.hesitationActiveT = 0;
        this.hesitationAngleOffsetRad = 0;
        console.log(`[CreatureBehavior] interaction hold root=${this.sceneObject.name}`);
    }

    endChase(): void {
        if (this.isReleased) return;
        if (this.state !== CreaturePresentationState.CHASING && this.state !== CreaturePresentationState.INTERACTING) return;

        // Eased back to idle wander, no snap: keep current position/velocity,
        // just change control mode and hand it a fresh wander destination.
        this.state = CreaturePresentationState.IDLE;
        this.wanderTarget = this.pickWanderTarget();
        this.isWaitingAtWanderTarget = false;
    }

    /**
     * One-shot, idempotent. A single boolean guard checked before any
     * mutation — repeat calls (double-tap, or a future arbiter re-issuing
     * the call) produce exactly one burst/fade/sound. The flag is never
     * reset; a released creature's lifecycle ends there. reset() (debug
     * only) is the sole way to start a fresh lifecycle on this instance.
     */
    release(): void {
        if (this.isReleased) return;
        if (this.state !== CreaturePresentationState.CHASING && this.state !== CreaturePresentationState.INTERACTING && this.state !== CreaturePresentationState.IDLE) return;
        if (!this.body || !this.body.renderMeshVisual || !this.particleAnchorObject) return;

        this.isReleased = true;
        this.state = CreaturePresentationState.RELEASING;

        // eyeRmvs is empty when there are no eye parts (ready-made dog/cat
        // GLBs) — ReleaseEffect.play() accepts an empty list, it just brightens
        // the body alone.
        const eyeRmvs = this.eyeLeft && this.eyeRight ? [this.eyeLeft.white, this.eyeRight.white, this.eyeLeft.pupilVisual, this.eyeRight.pupilVisual] : [];
        this.releaseEffect = new ReleaseEffect();
        this.releaseEffect.play(
            this,
            this.particleAnchorObject,
            this.body.renderMeshVisual,
            eyeRmvs,
            this.audioComponent,
            () => {
                // Guard against a stale completion firing after reset() has already
                // started a fresh lifecycle in the meantime (e.g. a debug reset()
                // issued mid-effect) — only disable if we're still the RELEASING
                // instance this callback belongs to. Without this, an in-flight
                // effect's completion can disable a creature that has already been
                // reset back to IDLE, since the DelayedCallbackEvent scheduled by
                // play() doesn't know reset() happened.
                if (this.state !== CreaturePresentationState.RELEASING) return;
                // Save-before-effect is the repository's job (out of scope here);
                // this is the one-shot presentation event only. Disable (not
                // destroy) so the debug trigger can reset() for repeat testing.
                this.sceneObject.enabled = false;
            },
        );
    }

    /** Debug-only: re-enables the creature and starts a fresh IDLE lifecycle. */
    reset(): void {
        this.resetToIdle();
    }

    /**
     * Debug-only: re-anchors the world-space habitat zone on the camera's
     * CURRENT position/forward, without touching lifecycle/state — for
     * preview and recording, when the camera has moved far from where the
     * habitat was last anchored and the creature needs to be brought back
     * into shot. The habitat stays world-anchored otherwise (captured once
     * at spawn/reset, not continuously recentered on the camera) per the
     * design; this is a manual one-shot nudge, not a change to that rule.
     */
    recenterHabitat(): void {
        if (this.isReleased) return;
        if (this.state === CreaturePresentationState.RELEASING) return;

        this.recomputeHabitatOrigin();

        if (this.state === CreaturePresentationState.IDLE) {
            // Only IDLE actually reads habitatCenter for movement (chase computes
            // its target from the live camera every frame, independent of this) —
            // pick a fresh wander target now so the recenter has a visible effect
            // immediately instead of waiting for the current leg to finish.
            this.wanderTarget = this.pickWanderTarget();
            this.isWaitingAtWanderTarget = false;
            // Snap rather than walk. This is a staging action: the operator is
            // framing a shot, and a CALM creature would otherwise cross the
            // room to the new anchor at WANDER_CALM_SPEED_CM_S (7 cm/s) — tens
            // of seconds for a large recenter, with the creature visibly
            // sliding the whole way.
            this.sceneObject.getTransform().setWorldPosition(this.wanderTarget);
            this.velocity = vec3.zero();
        }
    }

    // ── Lifecycle ────────────────────────────────────────────────────────

    private onStart(): void {
        if (!this.cameraObject) {
            console.error("[CreatureBehavior] cameraObject not wired — check Phase B bootstrap wiring.");
            return;
        }

        this.visualRootObject = findChildByName(this.sceneObject, "VisualRoot");
        this.bodyObject = this.visualRootObject ? findChildByName(this.visualRootObject, "Body") : null;
        this.particleAnchorObject = this.visualRootObject ? findChildByName(this.visualRootObject, "ParticleAnchor") : null;
        this.audioComponent = this.visualRootObject
            ? this.resolveReleaseAudio(this.visualRootObject)
            : null;
        // EyeLeft/EyeRight are authored placeholders from the earlier
        // procedural/mesh-generated visuals — still looked up (so a future
        // switch back to CreaturePetVisual's PetCreatureBody-style sibling
        // just works again) but NOT required: the ready-made dog/cat GLBs
        // have no eye sockets to attach to, and CreatureBehavior's
        // eye-dependent update paths (blink, eyelid/eye-scale/spacing,
        // mouth) are all separately guarded — only body orientation/gaze/
        // lean/breathing/posture/tint/growth run unconditionally.
        this.eyeLeftObject = this.bodyObject ? findChildByName(this.bodyObject, "EyeLeft") : null;
        this.eyeRightObject = this.bodyObject ? findChildByName(this.bodyObject, "EyeRight") : null;

        if (!this.bodyObject || !this.particleAnchorObject) {
            console.error("[CreatureBehavior] Body/ParticleAnchor not found. Check the authored scene hierarchy.");
            return;
        }

        // Species is chosen from the task's appearanceSeed, exactly like colour
        // (see setAppearanceSeed). The seed usually arrives AFTER this build —
        // the controller binds slots in its own onStart — so build the seed-0
        // species here and let setAppearanceSeed swap the body if the real seed
        // selects a different one.
        this.buildSpeciesVisual(speciesForSeed(this.appearanceSeed));
        this.shadowObject = buildCreatureShadow(this.visualRootObject!, eyeBaseMaterialAsset);

        this.resetToIdle();
    }

    private resetToIdle(): void {
        // Re-enable FIRST, before any other reset work below: if something later in
        // this function throws (observed in testing: a JS execution-timeout watchdog
        // firing mid-function under heavy editor load), the object should still end
        // up visible/enabled rather than permanently stuck disabled from a partial
        // reset — the remaining state fields are cheap to leave at their prior
        // values for one frame if that happens, but "invisible forever" is not
        // recoverable without a full Lens restart.
        this.sceneObject.enabled = true;
        this.isReleased = false;
        this.state = CreaturePresentationState.IDLE;
        this.timeS = 0;
        this.velocity = vec3.zero();
        this.facingDir = vec3.back(); // see the field declaration's comment — vec3.back() is (0,0,-1), not .forward().
        this.hesitationTimer = 0;
        this.hesitationAngleOffsetRad = 0;
        this.hesitationActiveT = 0;
        this.chaseAngularVel = 0;
        this.chaseRadialVel = 0;
        this.squashEnvelope = 0;
        this.prevMoveDir = null;
        this.bodyRestLocalY = 0;
        this.postureHeightScale = 1;
        this.postureWidthScale = 1;
        // Back to this creature's identity color, NOT the global BLOB_COLOR —
        // a reset must not erase the appearanceSeed-assigned color.
        this.currentTint = new vec4(this.baseBodyColor.x, this.baseBodyColor.y, this.baseBodyColor.z, this.baseBodyColor.w);
        this.walkBobPhase = 0;
        this.eyeLidClosure = EYELID_CALM_CLOSURE;
        this.eyeScaleMultiplier = EYE_SCALE_CALM;
        this.eyeSpacingCm = EYE_SPACING_CALM_CM;
        this.leanPitchDeg = LEAN_CALM_PITCH_DEG;
        this.mouthCurve = MOUTH_CURVE_CALM;
        this.isWaitingAtWanderTarget = false;
        this.wanderPauseTimer = 0;
        this.releaseEffect = null;
        this.blinkElapsed = 0;
        this.blinkTimer = this.randomRange(BLINK_INTERVAL_MIN_S, BLINK_INTERVAL_MAX_S);
        this.growthScale = 1.0;
        this.targetGrowthScale = 1.0;
        if (this.visualRootObject) {
            this.presentationScale = ART.habitatVisualScale;
            this.visualRootObject.getTransform().setLocalScale(vec3.one().uniformScale(this.presentationScale * this.growthScale));
            // Matches updatePresentationScale's ground-pivot compensation — set
            // once here too so the very first rendered frame (before onUpdate's
            // first tick) already has feet on the ground line, not the mesh
            // center.
            const baseOffsetCm = this.body ? this.body.baseOffsetCm : 0;
            this.visualRootObject.getTransform().setLocalPosition(new vec3(0, baseOffsetCm * this.presentationScale * this.growthScale, 0));
        }

        this.recomputeHabitatOrigin();
        this.wanderTarget = this.pickWanderTarget();
        // Start ON the habitat spot rather than gliding to it. Without this the
        // creature keeps whatever world position it had at reset (effectively the
        // camera/world origin) and seeks the target at WANDER_CALM_SPEED_CM_S —
        // which, now that the ground line is a real floor ~150cm below eye level
        // rather than a 20cm offset, is a multi-second visible descent from
        // mid-air on every Lens reset. A settled pet is already where it lives.
        this.sceneObject.getTransform().setWorldPosition(this.wanderTarget);

        if (this.bodyObject) {
            this.bodyObject.getTransform().setLocalPosition(vec3.zero());
            this.bodyObject.getTransform().setLocalScale(vec3.one());
        }

        // Restore a FRESH per-instance clone of the base (un-brightened) body
        // material — never reassign the shared bodyBaseMaterialAsset directly,
        // since updateColorTint() mutates mainPass.baseColor every frame from
        // here on; mutating the shared asset itself would bleed one
        // creature's tint onto every sibling using it. release()'s brighten
        // clone is discarded here, not reused, since it also never touches
        // the shared asset (clone-before-mutate).
        if (this.body) this.body.applyBaseMaterial(bodyBaseMaterialAsset, this.currentTint);
        if (this.eyeLeft) this.eyeLeft.pupilVisual.mainMaterial = eyeBaseMaterialAsset;
        if (this.eyeRight) this.eyeRight.pupilVisual.mainMaterial = eyeBaseMaterialAsset;
    }

    /**
     * Reads the camera's CURRENT position/forward into habitatCenter /
     * habitatForwardYaw / wanderTargetY. Shared by resetToIdle() (habitat is
     * anchored once at spawn/reset) and the debug-only recenterHabitat()
     * (a manual re-anchor for preview/recording) — the habitat is otherwise
     * world-anchored, not continuously recentered on the camera every frame.
     *
     * wanderTargetY is the literal ground/floor Y (camera-relative) —
     * HabitatFloor's disc reads the exact same ART.groundYOffsetCm constant
     * for its own Y, so MovementRoot and the floor plane can never drift
     * apart. (Previously this was the mesh's vertical CENTER, matched
     * against a separately-derived, independently-tuned HabitatFloor
     * formula — the two numbers only coincidentally lined up for one
     * specific Preview environment. See CreatureConfig's ART.groundYOffsetCm
     * doc comment for the full root-cause note.)
     */
    private recomputeHabitatOrigin(): void {
        if (!this.cameraObject) return;
        const camTransform = this.cameraObject.getTransform();
        const camPos = camTransform.getWorldPosition();
        // Verified empirically (console.log + Preview panel capture): for this
        // project's Camera Object, Transform.forward reports the OPPOSITE of the
        // direction the camera actually renders toward (returns +Z while the
        // camera visibly looks down -Z) — negate it here so the habitat is
        // centered on where the user can actually see the creature, not on the
        // space behind them.
        const camFwd = camTransform.forward.uniformScale(-1);
        this.habitatForwardYaw = Math.atan2(camFwd.x, -camFwd.z);
        // Flatten the camera's forward onto the horizontal plane before using
        // it as the depth axis. Using the raw 3D forward made the habitat
        // depend on head PITCH: looking down 40 degrees placed the homes at
        // homeDepthCm * cos(40) = 77% of the intended distance (240cm became
        // 184cm) and dragged habitatCenter's Y down with it, which then had to
        // be overridden by the ground line anyway. The habitat is a spot on
        // the floor in front of the user; where they happen to be looking when
        // it is anchored must not move it.
        const flatFwd = new vec3(Math.sin(this.habitatForwardYaw), 0, -Math.cos(this.habitatForwardYaw));
        if (this.homeAnchorConfigured) {
            const right = new vec3(Math.cos(this.habitatForwardYaw), 0, Math.sin(this.habitatForwardYaw));
            this.habitatCenter = camPos
                .add(flatFwd.uniformScale(this.homeDepthCm))
                .add(right.uniformScale(this.homeLateralOffsetCm));
        } else {
            this.habitatCenter = camPos;
        }
        this.wanderTargetY = camPos.y + (this.homeAnchorConfigured ? this.homeVerticalOffsetCm : HABITAT_VERTICAL_OFFSET_CM);
    }

    private onUpdate(): void {
        if (!this.bodyObject || this.state === CreaturePresentationState.RELEASING) return;
        const dt = getDeltaTime();
        this.timeS += dt;

        if (this.state === CreaturePresentationState.IDLE) {
            this.updateIdle(dt);
        } else if (this.state === CreaturePresentationState.CHASING) {
            this.updateChasing(dt);
        } else if (this.state === CreaturePresentationState.INTERACTING) {
            this.updateInteractionHold(dt);
        }

        this.updatePresentationScale(dt);
        this.applyBodyScale(dt);
        this.updateColorTint(dt);
        this.updateExpression(dt);
        this.updateFaceAndSecondaryMotion(dt);
    }

    /** CALM/URGENT/CHASE — the single switch breathing, posture, tint, gaze
     *  (for IDLE), and the expressive face below all key off, so every
     *  amplified channel can never drift out of sync with any other. */
    private emotionalProfile(): "CALM" | "URGENT" | "CHASE" {
        if (this.state === CreaturePresentationState.CHASING || this.state === CreaturePresentationState.INTERACTING) return "CHASE";
        return this.isUrgent ? "URGENT" : "CALM";
    }

    /**
     * The expressive face: body lean always eases toward emotionalProfile()'s
     * target (it's a Body-transform channel, available on any mesh); eyelid
     * closure, eye scale/spacing, and mouth curve only exist — and only
     * ease — when EyeLeft/EyeRight are actually present (the ready-made
     * dog/cat GLBs have none, and CreatureBehavior must not fake parts that
     * aren't there). Adding a new lean-like channel is a single new eased
     * field + one three-way pick here — no other method needs to know
     * about it, per the "single state value drives everything" constraint.
     */
    private updateExpression(dt: number): void {
        const profile = this.emotionalProfile();
        const alpha = clamp01(dt * EXPRESSION_EASE_PER_S);

        const targetLean = profile === "CALM" ? LEAN_CALM_PITCH_DEG : profile === "URGENT" ? LEAN_URGENT_PITCH_DEG : LEAN_CHASE_PITCH_DEG;
        this.leanPitchDeg += (targetLean - this.leanPitchDeg) * alpha;

        if (!this.eyeLeftObject || !this.eyeRightObject) return;
        const targetLid = profile === "CALM" ? EYELID_CALM_CLOSURE : profile === "URGENT" ? EYELID_URGENT_CLOSURE : EYELID_CHASE_CLOSURE;
        const targetEyeScale = profile === "CALM" ? EYE_SCALE_CALM : profile === "URGENT" ? EYE_SCALE_URGENT : EYE_SCALE_CHASE;
        const targetSpacing = profile === "CALM" ? EYE_SPACING_CALM_CM : profile === "URGENT" ? EYE_SPACING_URGENT_CM : EYE_SPACING_CHASE_CM;
        const targetMouth = profile === "CALM" ? MOUTH_CURVE_CALM : profile === "URGENT" ? MOUTH_CURVE_URGENT : MOUTH_CURVE_CHASE;

        this.eyeLidClosure += (targetLid - this.eyeLidClosure) * alpha;
        this.eyeScaleMultiplier += (targetEyeScale - this.eyeScaleMultiplier) * alpha;
        this.eyeSpacingCm += (targetSpacing - this.eyeSpacingCm) * alpha;
        this.mouthCurve += (targetMouth - this.mouthCurve) * alpha;

        this.eyeLeftObject.getTransform().setLocalPosition(new vec3(this.eyeSpacingCm, EYE_OFFSET_Y_CM, EYE_OFFSET_Z_CM));
        this.eyeRightObject.getTransform().setLocalPosition(new vec3(-this.eyeSpacingCm, EYE_OFFSET_Y_CM + 0.15, EYE_OFFSET_Z_CM));

        if (this.mouth) this.mouth.updateCurve(this.mouthCurve);
    }

    // ── IDLE: breathing/posture/tint (applyBodyScale/updateColorTint) + wander + gaze ──

    private updateIdle(dt: number): void {
        this.updateWander(dt);
        if (this.isUrgent) {
            this.updateGazeUrgent(dt);
        } else {
            this.updateGazeCalm(dt);
        }
    }

    private updateWander(dt: number): void {
        if (!this.wanderTarget) {
            this.wanderTarget = this.pickWanderTarget();
        }

        const pos = this.sceneObject.getTransform().getWorldPosition();
        const dist = this.wanderTarget.sub(pos).length;

        if (dist <= WANDER_DEAD_ZONE_RADIUS_CM) {
            if (!this.isWaitingAtWanderTarget) {
                this.isWaitingAtWanderTarget = true;
                this.wanderPauseTimer = this.isUrgent
                    ? this.randomRange(WANDER_URGENT_REPICK_PAUSE_MIN_S, WANDER_URGENT_REPICK_PAUSE_MAX_S)
                    : this.randomRange(WANDER_CALM_REPICK_PAUSE_MIN_S, WANDER_CALM_REPICK_PAUSE_MAX_S);
            }
            this.velocity = vec3.zero();
            this.wanderPauseTimer -= dt;
            if (this.wanderPauseTimer <= 0) {
                this.wanderTarget = this.pickWanderTarget();
                this.isWaitingAtWanderTarget = false;
            }
            return;
        }

        this.isWaitingAtWanderTarget = false;
        const result = stepSeekArrive(
            pos,
            this.velocity,
            this.wanderTarget,
            this.isUrgent ? WANDER_URGENT_SPEED_CM_S : WANDER_CALM_SPEED_CM_S,
            this.isUrgent ? WANDER_URGENT_MAX_ACCEL_CM_S2 : WANDER_CALM_MAX_ACCEL_CM_S2,
            WANDER_ARRIVAL_RADIUS_CM,
            WANDER_DEAD_ZONE_RADIUS_CM,
            dt,
        );
        this.velocity = result.velocity;
        this.sceneObject.getTransform().setWorldPosition(result.position);

        if (result.velocity.length > 0.5) {
            const dir = result.velocity.normalize();
            this.checkSquashStretch(dir);
        }
    }

    /**
     * CALM gaze: a slow, unhurried sweep centered on habitatForwardYaw — the
     * direction FROM the camera INTO the habitat, i.e. away from the user
     * (see recomputeHabitatOrigin). Deliberately ignores the camera's live
     * position entirely, unlike updateGazeUrgent — that's the whole signal.
     */
    private updateGazeCalm(dt: number): void {
        const driftRad = (GAZE_CALM_DRIFT_RANGE_DEG * Math.PI) / 180 * Math.sin(this.timeS * GAZE_CALM_DRIFT_HZ * Math.PI * 2);
        const yaw = this.habitatForwardYaw + driftRad;
        const desiredDir = new vec3(Math.sin(yaw), 0, -Math.cos(yaw));
        this.updateFacingLimited(desiredDir, dt, GAZE_CALM_YAW_SPEED_DEG_S);
    }

    /**
     * URGENT gaze: locks onto the camera's live position (fast turn speed —
     * "keeps turning to face the user") with a fast small tremor layered on
     * top so the hold itself reads as anxious, not statically staring.
     */
    private updateGazeUrgent(dt: number): void {
        if (!this.cameraObject || !this.bodyObject) return;
        const camPos = this.cameraObject.getTransform().getWorldPosition();
        const pos = this.bodyObject.getTransform().getWorldPosition();
        const toCamera = camPos.sub(pos);
        toCamera.y = 0;
        if (toCamera.length < 0.5) return;
        const baseYaw = Math.atan2(toCamera.x, -toCamera.z);
        const tremorRad = (GAZE_URGENT_TREMOR_DEG * Math.PI) / 180 * Math.sin(this.timeS * GAZE_URGENT_TREMOR_HZ * Math.PI * 2);
        const yaw = baseYaw + tremorRad;
        const desiredDir = new vec3(Math.sin(yaw), 0, -Math.cos(yaw));
        this.updateFacingLimited(desiredDir, dt, GAZE_URGENT_YAW_SPEED_DEG_S);
    }

    private pickWanderTarget(): vec3 {
        if (this.homeAnchorConfigured) {
            const angle = Math.random() * Math.PI * 2;
            // URGENT roams an ABSOLUTE radius around home (a real walk);
            // CALM scales the tiny 3cm home-jitter radius, which at scale 0
            // means "the home anchor itself" — i.e. arrive once and stay.
            const maxRadius = this.isUrgent
                ? WANDER_URGENT_RADIUS_CM
                : this.homeWanderRadiusCm * WANDER_CALM_RADIUS_SCALE;
            const radius = Math.sqrt(Math.random()) * maxRadius;
            return new vec3(
                this.habitatCenter.x + Math.cos(angle) * radius,
                this.wanderTargetY,
                this.habitatCenter.z + Math.sin(angle) * radius,
            );
        }
        const halfArcRad = (HABITAT_ARC_HALF_ANGLE_DEG * Math.PI) / 180;
        const angleOffset = (Math.random() * 2 - 1) * halfArcRad;
        const angle = this.habitatForwardYaw + angleOffset;
        // No home anchor configured: fall back to the open habitat ring. CALM
        // still collapses to the ring's inner edge via WANDER_CALM_RADIUS_SCALE;
        // URGENT uses the full ring, which is already far wider than the
        // home-anchored roam radius, so it needs no extra scaling.
        const dist = this.randomRange(HABITAT_RADIUS_MIN_CM, HABITAT_RADIUS_MAX_CM)
            * (this.isUrgent ? 1 : WANDER_CALM_RADIUS_SCALE);

        // Reconstruct a direction vector from a yaw angle the same way faceDirection's
        // formula reads one back: yaw = atan2(dir.x, -dir.z) => dir = (sin(yaw), 0, -cos(yaw)).
        const dirX = Math.sin(angle);
        const dirZ = -Math.cos(angle);

        return new vec3(this.habitatCenter.x + dirX * dist, this.wanderTargetY, this.habitatCenter.z + dirZ * dist);
    }

    private updateInteractionHold(dt: number): void {
        if (!this.cameraObject) return;
        const camPos = this.cameraObject.getTransform().getWorldPosition();
        const pos = this.sceneObject.getTransform().getWorldPosition();
        const toCam = camPos.sub(pos);
        if (toCam.length > 0.5) this.updateFacing(toCam.normalize(), dt);
    }

    // ── CHASING: decoupled polar seek (radius + angle around the camera) ───
    //
    // Steering the creature toward a single Cartesian target point (the naive
    // approach) can cut close to the camera whenever the creature's current
    // angle and the target's angle are far apart — for a near-opposite start
    // (observed in testing: ~165° apart), the straight-line path passes
    // almost through the camera itself. A hard-stop clamp on that path either
    // kills too much momentum (stalls for tens of seconds, reproduced
    // directly) or, if left alone, still wastes most of a frame's motion
    // being clamped back to the floor every time. Steering radius and angle
    // as two INDEPENDENT capped-accel seeks sidesteps the problem entirely:
    // the radial target (chaseDistanceCm, always ≥110cm) never sits below the
    // 100cm floor, so radial motion alone can never approach it — no clamp
    // needed at all — while the angular seek turns the creature around the
    // camera at a bounded, predictable rate regardless of the starting gap.
    private updateChasing(dt: number): void {
        if (!this.cameraObject) return;

        this.chaseCueElapsed += dt;
        const cueDuration = CHASE_LOOK_PAUSE_S + CHASE_ANTICIPATION_S;
        if (this.chaseCueElapsed < cueDuration) {
            this.velocity = vec3.zero();
            this.updateCameraFrontBias(dt);
            const anticipationT = clamp01((this.chaseCueElapsed - CHASE_LOOK_PAUSE_S) / CHASE_ANTICIPATION_S);
            // Written to bodyRestLocalY, not setLocalPosition — applyBodyScale()
            // is the single place that sets Body's local Y each frame (rest +
            // base-pivot compensation), so this dip and that compensation never
            // clobber each other (see bodyRestLocalY's field comment).
            this.bodyRestLocalY = anticipationT > 0 ? -CHASE_ANTICIPATION_DIP_CM * Math.sin(anticipationT * Math.PI) : 0;
            return;
        }
        this.bodyRestLocalY = 0;

        this.hesitationTimer -= dt;
        if (this.hesitationTimer <= 0 && this.hesitationActiveT <= 0) {
            this.hesitationActiveT = CHASE_HESITATION_DURATION_S;
            this.hesitationAngleOffsetRad = ((Math.random() * 2 - 1) * CHASE_HESITATION_ANGLE_DEG * Math.PI) / 180;
            this.hesitationTimer = this.randomRange(CHASE_HESITATION_INTERVAL_MIN_S, CHASE_HESITATION_INTERVAL_MAX_S);
        }
        if (this.hesitationActiveT > 0) {
            this.hesitationActiveT -= dt;
            if (this.hesitationActiveT <= 0) {
                this.hesitationAngleOffsetRad = 0;
            }
        }

        const camTransform = this.cameraObject.getTransform();
        const camPos = camTransform.getWorldPosition();
        // See the matching comment in resetToIdle() — Transform.forward is inverted
        // relative to this camera's actual view direction; negate it here too so
        // the chase target sits in front of the user, not behind them.
        const camForward = camTransform.forward.uniformScale(-1);
        const camForwardYaw = Math.atan2(camForward.x, -camForward.z);
        const sideRad = (this.chaseSideDeg * Math.PI) / 180;
        // Hesitant, cat-like approach: not a straight beeline — a small angular
        // dart is added and removed periodically on top of the direct target angle.
        const targetAngleRad = camForwardYaw + sideRad + this.hesitationAngleOffsetRad;

        const beforePos = this.sceneObject.getTransform().getWorldPosition();

        // Radial seek toward chaseDistanceCm (110-130cm) — reuses stepSeekArrive
        // as a 1D scalar seek (y/z pinned to 0). Since the target is always well
        // above ART.chaseStopDistanceCm, this alone keeps the creature at-or-beyond
        // the floor; the Math.max below is a defensive backstop, not a corrective
        // clamp that fights the steering (unlike the old Cartesian version).
        const radialResult = stepSeekArrive(
            new vec3(this.chaseRadiusCm, 0, 0),
            new vec3(this.chaseRadialVel, 0, 0),
            new vec3(this.chaseDistanceCm, 0, 0),
            MAX_SPEED_CM_S,
            CHASE_MAX_ACCEL_CM_S2,
            CHASE_ARRIVAL_RADIUS_CM,
            CHASE_DEAD_ZONE_RADIUS_CM,
            dt,
        );
        this.chaseRadialVel = radialResult.velocity.x;
        this.chaseRadiusCm = Math.max(radialResult.position.x, ART.chaseStopDistanceCm);
        if (this.chaseRadiusCm <= ART.chaseStopDistanceCm && this.chaseRadialVel < 0) {
            this.chaseRadialVel = 0;
        }

        // Angular seek toward targetAngleRad. Max angular speed/accel are derived
        // from the SAME MAX_SPEED_CM_S / CHASE_MAX_ACCEL_CM_S2 constants divided
        // by the current radius, so tangential speed never exceeds the spec'd
        // 0.5 m/s cap regardless of how far out the creature currently is.
        const maxAngularSpeed = MAX_SPEED_CM_S / Math.max(this.chaseRadiusCm, 1);
        const maxAngularAccel = CHASE_MAX_ACCEL_CM_S2 / Math.max(this.chaseRadiusCm, 1);
        const angularResult = stepSeekArriveAngular(
            this.chaseAngleRad,
            this.chaseAngularVel,
            targetAngleRad,
            maxAngularSpeed,
            maxAngularAccel,
            (CHASE_ANGULAR_ARRIVAL_DEG * Math.PI) / 180,
            (CHASE_ANGULAR_DEAD_ZONE_DEG * Math.PI) / 180,
            dt,
        );
        this.chaseAngularVel = angularResult.angularVelocity;
        this.chaseAngleRad = angularResult.angleRad;

        // Reconstruct world position from (angle, radius) — inverse of
        // faceDirection's yaw = atan2(dir.x, -dir.z), i.e. dir = (sin(yaw), -cos(yaw)),
        // the same convention pickWanderTarget already uses.
        const newPos = new vec3(
            camPos.x + Math.sin(this.chaseAngleRad) * this.chaseRadiusCm,
            this.wanderTargetY,
            camPos.z - Math.cos(this.chaseAngleRad) * this.chaseRadiusCm,
        );
        this.sceneObject.getTransform().setWorldPosition(newPos);

        // Front stays oriented toward the camera throughout the chase.
        const toCam = camPos.sub(newPos);
        if (toCam.length > 0.5) {
            this.updateFacingLimited(toCam.normalize(), dt, CHASE_MAX_YAW_SPEED_DEG_S);
        }

        const moveDelta = newPos.sub(beforePos);
        if (moveDelta.length > 0.5) {
            this.checkSquashStretch(moveDelta.normalize());
        }
    }

    // ── Shared animation helpers ────────────────────────────────────────────

    private updateFacing(desiredDir: vec3, dt: number): void {
        if (!this.bodyObject) return;
        const alpha = clamp01(dt * FACE_TURN_RATE_PER_S);
        this.facingDir = vec3.slerp(this.facingDir, desiredDir, alpha).normalize();
    }

    /** Pre-chase "notice the user" cue only (see updateChasing) — IDLE gaze is
     *  handled separately by updateGazeCalm/updateGazeUrgent. */
    private updateCameraFrontBias(dt: number): void {
        if (!this.cameraObject) return;
        const camPos = this.cameraObject.getTransform().getWorldPosition();
        const pos = this.sceneObject.getTransform().getWorldPosition();
        const toCamera = camPos.sub(pos);
        toCamera.y = 0;
        if (toCamera.length < 0.5) return;
        this.updateFacingLimited(toCamera.normalize(), dt, CHASE_MAX_YAW_SPEED_DEG_S);
    }

    private updateFacingLimited(desiredDir: vec3, dt: number, maxDegreesPerSecond: number): void {
        const currentYaw = Math.atan2(this.facingDir.x, -this.facingDir.z);
        const desiredYaw = Math.atan2(desiredDir.x, -desiredDir.z);
        const delta = this.wrapAngle(desiredYaw - currentYaw);
        const maxStep = maxDegreesPerSecond * Math.PI / 180 * dt;
        const nextYaw = currentYaw + Math.max(-maxStep, Math.min(maxStep, delta));
        this.facingDir = new vec3(Math.sin(nextYaw), 0, -Math.cos(nextYaw));
    }

    private updatePresentationScale(dt: number): void {
        if (!this.visualRootObject) return;
        const urgent = this.state === CreaturePresentationState.CHASING || this.state === CreaturePresentationState.INTERACTING;
        const target = urgent ? ART.chaseVisualScale : ART.habitatVisualScale;
        this.presentationScale += (target - this.presentationScale) * clamp01(dt * PRESENTATION_SCALE_EASE_PER_S);
        this.growthScale += (this.targetGrowthScale - this.growthScale) * clamp01(dt * GROWTH_EASE_PER_S);
        this.visualRootObject.getTransform().setLocalScale(vec3.one().uniformScale(this.presentationScale * this.growthScale));

        // Ground-pivot compensation: VisualRoot's local origin sits at the
        // mesh's vertical CENTER (same "Body's own local scale never moves
        // the feet" convention baseOffsetCm documents for applyBodyScale),
        // so scaling VisualRoot itself — CALM<->CHASE presentation scale,
        // whole-body growth — drags the feet up/down with it exactly like
        // Body's own breathing scale did before that compensation existed.
        // MovementRoot's world Y is ART.groundYOffsetCm directly now (see
        // recomputeHabitatOrigin) — the single shared floor reference
        // HabitatFloor also reads — so lifting VisualRoot's local origin by
        // baseOffsetCm * (current total scale) keeps the rendered feet
        // pinned exactly on that floor line regardless of which
        // presentation scale is currently active.
        const baseOffsetCm = this.body ? this.body.baseOffsetCm : 0;
        const totalScale = this.presentationScale * this.growthScale;
        this.visualRootObject.getTransform().setLocalPosition(new vec3(0, baseOffsetCm * totalScale, 0));
    }

    private wrapAngle(angle: number): number {
        while (angle > Math.PI) angle -= Math.PI * 2;
        while (angle < -Math.PI) angle += Math.PI * 2;
        return angle;
    }

    /**
     * Body orientation (yaw from gaze/facing, pitch from lean + motion
     * wobble, roll from movement tilt+sway) always runs — this is the
     * "orientation and gaze toward the user" channel and must work on any
     * mesh. Blink + eyelid/eye-scale rendering only runs when EyeLeft/
     * EyeRight actually exist.
     */
    private updateFaceAndSecondaryMotion(dt: number): void {
        if (!this.bodyObject) return;

        const speed01 = clamp01(this.velocity.length / MAX_SPEED_CM_S);
        const yaw = Math.atan2(this.facingDir.x, -this.facingDir.z);
        // BODY_SECONDARY_SWAY_DEG used to apply unconditionally — a constant
        // +/-2.5deg roll oscillation even at velocity 0, which read as a
        // stationary creature rocking side to side. It's a walk-cycle wobble
        // (same family as BODY_MOVE_TILT_DEG just above it), so gate it by
        // speed01 too: full strength while actually moving (URGENT wander,
        // chase), zero once CALM settles and stops.
        const roll = ((BODY_MOVE_TILT_DEG * speed01) + BODY_SECONDARY_SWAY_DEG * speed01 * Math.sin(this.timeS * 3.1)) * Math.PI / 180;
        const pitch = Math.sin(this.timeS * 2.2) * speed01 * 0.035 + (this.leanPitchDeg * Math.PI) / 180;
        this.bodyObject.getTransform().setLocalRotation(quat.fromEulerAngles(pitch, yaw, -roll));

        if (!this.eyeLeft || !this.eyeRight) return;
        this.blinkTimer -= dt;
        if (this.blinkTimer <= 0 && this.blinkElapsed <= 0) this.blinkElapsed = BLINK_DURATION_S;
        if (this.blinkElapsed > 0) {
            this.blinkElapsed = Math.max(0, this.blinkElapsed - dt);
            if (this.blinkElapsed === 0) this.blinkTimer = this.randomRange(BLINK_INTERVAL_MIN_S, BLINK_INTERVAL_MAX_S);
        }
        CreatureEyes.updateExpression(this.eyeLeft, this.eyeLidClosure, this.blinkElapsed, this.eyeScaleMultiplier);
        CreatureEyes.updateExpression(this.eyeRight, this.eyeLidClosure, this.blinkElapsed, this.eyeScaleMultiplier);
    }

    private checkSquashStretch(dir: vec3): void {
        if (this.prevMoveDir) {
            const dot = this.prevMoveDir.x * dir.x + this.prevMoveDir.y * dir.y + this.prevMoveDir.z * dir.z;
            if (dot < SQUASH_STRETCH_DIRECTION_DOT_THRESHOLD) {
                this.squashEnvelope = 1;
            }
        }
        this.prevMoveDir = dir;
    }

    /**
     * Composes four multiplicative, non-uniform-scale channels onto Body —
     * no new geometry, per the design constraint:
     *   1. Breathing — per-state amplitude/frequency (CALM slow+deep,
     *      URGENT fast+shallow, CHASE intermediate).
     *   2. Posture — eased per-state height/width target (CALM lower+wider,
     *      URGENT taller+narrower, CHASE in between).
     *   3. Tremor — fast small wobble, URGENT only, layered on posture.
     *   4. Squash/stretch — the pre-existing damped anisotropic envelope
     *      triggered on direction change (unchanged, still composes here).
     */
    private applyBodyScale(dt: number): void {
        if (!this.bodyObject) return;

        if (this.squashEnvelope > 0) {
            this.squashEnvelope = Math.max(0, this.squashEnvelope - dt / SQUASH_STRETCH_DURATION_S);
        }

        const profile = this.emotionalProfile();

        const breatheAmp = profile === "CALM" ? ART.breatheCalmAmplitude : profile === "URGENT" ? ART.breatheUrgentAmplitude : ART.breatheChaseAmplitude;
        const breatheHz = profile === "CALM" ? BREATHE_CALM_FREQUENCY_HZ : profile === "URGENT" ? BREATHE_URGENT_FREQUENCY_HZ : BREATHE_CHASE_FREQUENCY_HZ;
        const breathe = 1 + breatheAmp * Math.sin(this.timeS * breatheHz * Math.PI * 2);

        const targetHeight = profile === "CALM" ? ART.postureCalmHeight : profile === "URGENT" ? ART.postureUrgentHeight : ART.postureChaseHeight;
        const targetWidth = profile === "CALM" ? ART.postureCalmWidth : profile === "URGENT" ? ART.postureUrgentWidth : ART.postureChaseWidth;
        const postureAlpha = clamp01(dt * POSTURE_EASE_PER_S);
        this.postureHeightScale += (targetHeight - this.postureHeightScale) * postureAlpha;
        this.postureWidthScale += (targetWidth - this.postureWidthScale) * postureAlpha;

        const tremor = profile === "URGENT" ? 1 + POSTURE_URGENT_TREMOR_AMPLITUDE * Math.sin(this.timeS * POSTURE_URGENT_TREMOR_HZ * Math.PI * 2) : 1;

        const u = 1 - this.squashEnvelope; // 0 at trigger, 1 once settled
        const wave = Math.cos(u * Math.PI * 1.5) * (1 - u);
        const scaleY = 1 - SQUASH_STRETCH_AMOUNT * wave;
        const scaleXZ = 1 + SQUASH_STRETCH_AMOUNT * 0.5 * wave;

        const finalY = breathe * scaleY * this.postureHeightScale * tremor;
        const finalXZ = breathe * scaleXZ * this.postureWidthScale * tremor;

        this.bodyObject.getTransform().setLocalScale(new vec3(finalXZ, finalY, finalXZ));

        // Base-pivot compensation: Body's local origin sits at the mesh's
        // vertical CENTER (see CreatureVisual.baseOffsetCm), so scaling
        // Body's own transform — which is the only way to animate breathing/
        // posture/squash without new geometry — stretches vertices AWAY from
        // that center on both sides. Left uncompensated, any Y-scale change
        // (breathing's slow pulse chief among them) drags the feet up/down
        // with it: a vertical bob that lifts the model off the floor or
        // sinks it through on every inhale/exhale. Shifting Body's local Y by
        // baseOffsetCm * (finalY - 1) moves the scale pivot's effective
        // anchor down to the base instead: only the TOP grows/shrinks, the
        // feet stay pinned at rest height. bodyRestLocalY carries any other
        // intentional Y offset (currently only the chase anticipation dip)
        // so the two channels compose instead of overwriting each other.
        // Walk bob: the pet meshes have no leg rig, so translation alone reads
        // as sliding. A small vertical bounce whose cadence is locked to travel
        // speed supplies the missing footfall cue. abs(sin) gives two bounces
        // per phase cycle — a footfall rhythm rather than a float. Phase is
        // integrated (not derived from timeS) so cadence changes as the
        // creature accelerates without the bounce snapping mid-stride.
        //
        // Gated hard on current speed: a settled CALM creature has zero
        // velocity, so bob is exactly 0 and its feet stay flat on the ground
        // line — this does not reintroduce the always-on vertical bob that was
        // removed from breathing.
        const speedCmS = this.velocity.length;
        const bobStrength = clamp01(speedCmS / WALK_BOB_FULL_SPEED_CM_S);
        this.walkBobPhase += speedCmS * WALK_BOB_HZ_PER_CM_S * Math.PI * 2 * dt;
        const walkBobCm = bobStrength > 0
            ? WALK_BOB_AMPLITUDE_CM * bobStrength * Math.abs(Math.sin(this.walkBobPhase))
            : 0;

        const baseOffsetCm = this.body ? this.body.baseOffsetCm : 0;
        this.bodyObject.getTransform().setLocalPosition(new vec3(0, this.bodyRestLocalY + baseOffsetCm * (finalY - 1) + walkBobCm, 0));

        if (this.shadowObject) {
            const shadowScale = 0.92 + 0.08 * finalXZ;
            this.shadowObject.getTransform().setLocalScale(new vec3(shadowScale, 0.06, 0.64 * shadowScale));
        }
    }

    /**
     * Finds (or creates) this creature's AudioComponent and loads the release
     * track selected by RELEASE_SFX_VARIANT.
     *
     * Created rather than required: the AudioComponent was an optional
     * authored component, so a creature whose VisualRoot lacks one would have
     * been silently silent. Playback mode is set here, once, rather than on
     * every release — LowLatency trades a little memory for an immediate
     * start, which is what a one-shot cue tied to a visual beat needs.
     */
    private resolveReleaseAudio(visualRoot: SceneObject): AudioComponent | null {
        let audio = visualRoot.getComponent("Component.AudioComponent") as AudioComponent;
        if (!audio) audio = visualRoot.createComponent("Component.AudioComponent") as AudioComponent;
        if (!audio) return null;
        const track = releaseSfxTracks[RELEASE_SFX_VARIANT];
        if (track) {
            audio.audioTrack = track;
            audio.playbackMode = Audio.PlaybackMode.LowLatency;
        }
        return audio;
    }

    /** Warm-shifts the per-instance body material toward the state's tint
     *  target. The target is always this creature's OWN baseBodyColor blended
     *  a fraction toward TINT_HEAT_COLOR (CALM = the identity color itself,
     *  unblended), so rising urgency reads as the same creature heating up
     *  rather than every creature converging on one shared orange. */
    private updateColorTint(dt: number): void {
        if (!this.body || !this.body.renderMeshVisual) return;
        const profile = this.emotionalProfile();
        const blend = profile === "CALM" ? 0 : profile === "URGENT" ? TINT_URGENT_HEAT_BLEND : TINT_CHASE_HEAT_BLEND;
        const heat = new vec4(TINT_HEAT_COLOR[0], TINT_HEAT_COLOR[1], TINT_HEAT_COLOR[2], TINT_HEAT_COLOR[3]);
        const target = vec4.lerp(this.baseBodyColor, heat, blend);
        const alpha = clamp01(dt * TINT_EASE_PER_S);
        this.currentTint = vec4.lerp(this.currentTint, target, alpha);
        this.body.renderMeshVisual.mainMaterial.mainPass.baseColor = this.currentTint;
    }

    private randomRange(min: number, max: number): number {
        return min + Math.random() * (max - min);
    }
}
