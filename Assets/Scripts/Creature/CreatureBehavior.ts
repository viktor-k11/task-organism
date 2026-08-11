import { BlobMeshBuilder } from "./BlobMeshBuilder";
import { CreatureEyes } from "./CreatureEyes";
import { ReleaseEffect } from "./ReleaseEffect";
import { stepSeekArrive, stepSeekArriveAngular, faceDirection, clamp01, findChildByName } from "./CreatureMovement";
import {
    HABITAT_RADIUS_MIN_CM,
    HABITAT_RADIUS_MAX_CM,
    HABITAT_ARC_HALF_ANGLE_DEG,
    HABITAT_VERTICAL_OFFSET_CM,
    CHASE_DISTANCE_MIN_CM,
    CHASE_DISTANCE_MAX_CM,
    CHASE_SIDE_OFFSET_MIN_DEG,
    CHASE_SIDE_OFFSET_MAX_DEG,
    CHASE_STOP_DISTANCE_CM,
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
    BREATHE_AMPLITUDE,
    BREATHE_FREQUENCY_HZ,
    WANDER_SPEED_CM_S,
    WANDER_MAX_ACCEL_CM_S2,
    WANDER_ARRIVAL_RADIUS_CM,
    WANDER_DEAD_ZONE_RADIUS_CM,
    WANDER_REPICK_PAUSE_MIN_S,
    WANDER_REPICK_PAUSE_MAX_S,
    SQUASH_STRETCH_AMOUNT,
    SQUASH_STRETCH_DURATION_S,
    SQUASH_STRETCH_DIRECTION_DOT_THRESHOLD,
    GLANCE_INTERVAL_MIN_S,
    GLANCE_INTERVAL_MAX_S,
    GLANCE_HOP_HEIGHT_CM,
    GLANCE_HOP_DURATION_S,
    GLANCE_HOLD_DURATION_S,
    FACE_TURN_RATE_PER_S,
} from "../Config/CreatureConfig";

const bodyBaseMaterialAsset = requireAsset("../../Materials/BlobBody.mat") as Material;
const eyeBaseMaterialAsset = requireAsset("../../Materials/BlobEye.mat") as Material;

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
    RELEASING,
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
 *       BlobMeshBuilder (procedural mesh + wobble), CreatureEyes (static
 *       pupils), ReleaseEffect (one-shot particle/brighten/sound burst).
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
    @ui.group_end

    private state: CreaturePresentationState = CreaturePresentationState.IDLE;
    private isReleased = false;

    private bodyObject: SceneObject | null = null;
    private eyeLeftObject: SceneObject | null = null;
    private eyeRightObject: SceneObject | null = null;
    private particleAnchorObject: SceneObject | null = null;
    private audioComponent: AudioComponent | null = null;

    private blobMesh: BlobMeshBuilder | null = null;
    private eyeLeftRmv: RenderMeshVisual | null = null;
    private eyeRightRmv: RenderMeshVisual | null = null;
    private releaseEffect: ReleaseEffect | null = null;

    private timeS = 0;

    // Movement (Creature root world position) + facing (Body local yaw, eased).
    private velocity: vec3 = vec3.zero();
    private facingDir: vec3 = vec3.forward();

    // Habitat / wander — captured once at spawn/reset so the habitat is a
    // fixed world-space zone, not continuously recentered on the camera.
    private habitatCenter: vec3 = vec3.zero();
    private habitatForwardYaw = 0;
    private wanderTargetY = 0;
    private wanderTarget: vec3 | null = null;
    private wanderPauseTimer = 0;
    private isWaitingAtWanderTarget = false;
    private prevMoveDir: vec3 | null = null;

    // Glance-at-camera
    private glanceTimer = 0;
    private isGlancing = false;
    private glanceElapsed = 0;

    // Chase — polar steering (radius + angle around the camera), decoupled so
    // the radial distance can never dip toward the camera while the angle is
    // still catching up to a target on the far side (see updateChasing).
    private chaseDistanceCm = CHASE_DISTANCE_MIN_CM;
    private chaseSideDeg = CHASE_SIDE_OFFSET_MIN_DEG;
    private chaseAngleRad = 0;
    private chaseRadiusCm = CHASE_DISTANCE_MIN_CM;
    private chaseAngularVel = 0;
    private chaseRadialVel = 0;
    private hesitationTimer = 0;
    private hesitationAngleOffsetRad = 0;
    private hesitationActiveT = 0;

    // Squash & stretch envelope: 1 = just triggered, decays to 0.
    private squashEnvelope = 0;

    onAwake(): void {
        this.createEvent("OnStartEvent").bind(() => this.onStart());
        this.createEvent("UpdateEvent").bind(() => this.onUpdate());
    }

    // ── Public API — the seam AttentionArbiter (future) and the debug trigger call ──

    requestChase(): void {
        if (this.isReleased) return;
        if (this.state === CreaturePresentationState.CHASING) return;
        if (this.state === CreaturePresentationState.RELEASING) return;

        this.state = CreaturePresentationState.CHASING;
        this.isGlancing = false;
        this.chaseDistanceCm = this.randomRange(CHASE_DISTANCE_MIN_CM, CHASE_DISTANCE_MAX_CM);
        this.chaseSideDeg = this.randomRange(CHASE_SIDE_OFFSET_MIN_DEG, CHASE_SIDE_OFFSET_MAX_DEG) * (Math.random() < 0.5 ? -1 : 1);
        this.hesitationTimer = this.randomRange(CHASE_HESITATION_INTERVAL_MIN_S, CHASE_HESITATION_INTERVAL_MAX_S);
        this.hesitationActiveT = 0;
        this.hesitationAngleOffsetRad = 0;

        // Seed polar chase state from the CURRENT position so entering chase
        // never snaps — the angular/radial seek then eases from here.
        if (this.cameraObject) {
            const camPos = this.cameraObject.getTransform().getWorldPosition();
            const curPos = this.sceneObject.getTransform().getWorldPosition();
            const dx = curPos.x - camPos.x;
            const dz = curPos.z - camPos.z;
            const flatDist = Math.sqrt(dx * dx + dz * dz);
            this.chaseRadiusCm = flatDist > 0.0001 ? flatDist : CHASE_DISTANCE_MIN_CM;
            this.chaseAngleRad = flatDist > 0.0001 ? Math.atan2(dx, -dz) : 0;
        }
        this.chaseAngularVel = 0;
        this.chaseRadialVel = 0;
    }

    endChase(): void {
        if (this.isReleased) return;
        if (this.state !== CreaturePresentationState.CHASING) return;

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
        if (this.state !== CreaturePresentationState.CHASING && this.state !== CreaturePresentationState.IDLE) return;
        if (!this.blobMesh || !this.eyeLeftRmv || !this.eyeRightRmv || !this.particleAnchorObject) return;

        this.isReleased = true;
        this.state = CreaturePresentationState.RELEASING;

        this.releaseEffect = new ReleaseEffect();
        this.releaseEffect.play(
            this,
            this.particleAnchorObject,
            this.blobMesh.renderMeshVisual,
            [this.eyeLeftRmv, this.eyeRightRmv],
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
        }
    }

    // ── Lifecycle ────────────────────────────────────────────────────────

    private onStart(): void {
        if (!this.cameraObject) {
            console.error("[CreatureBehavior] cameraObject not wired — check Phase B bootstrap wiring.");
            return;
        }

        this.bodyObject = findChildByName(this.sceneObject, "Body");
        this.eyeLeftObject = this.bodyObject ? findChildByName(this.bodyObject, "EyeLeft") : null;
        this.eyeRightObject = this.bodyObject ? findChildByName(this.bodyObject, "EyeRight") : null;
        this.particleAnchorObject = findChildByName(this.sceneObject, "ParticleAnchor");
        this.audioComponent = this.sceneObject.getComponent("Component.AudioComponent") as AudioComponent;

        if (!this.bodyObject || !this.eyeLeftObject || !this.eyeRightObject || !this.particleAnchorObject) {
            console.error("[CreatureBehavior] Body/EyeLeft/EyeRight/ParticleAnchor not found. Check the authored scene hierarchy.");
            return;
        }

        this.blobMesh = new BlobMeshBuilder(this.bodyObject, bodyBaseMaterialAsset);
        this.eyeLeftRmv = CreatureEyes.build(this.eyeLeftObject, eyeBaseMaterialAsset);
        this.eyeRightRmv = CreatureEyes.build(this.eyeRightObject, eyeBaseMaterialAsset);

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
        this.facingDir = vec3.forward();
        this.hesitationTimer = 0;
        this.hesitationAngleOffsetRad = 0;
        this.hesitationActiveT = 0;
        this.chaseAngularVel = 0;
        this.chaseRadialVel = 0;
        this.squashEnvelope = 0;
        this.prevMoveDir = null;
        this.isGlancing = false;
        this.glanceElapsed = 0;
        this.glanceTimer = this.randomRange(GLANCE_INTERVAL_MIN_S, GLANCE_INTERVAL_MAX_S);
        this.isWaitingAtWanderTarget = false;
        this.wanderPauseTimer = 0;
        this.releaseEffect = null;

        this.recomputeHabitatOrigin();
        this.wanderTarget = this.pickWanderTarget();

        if (this.bodyObject) {
            this.bodyObject.getTransform().setLocalPosition(vec3.zero());
            this.bodyObject.getTransform().setLocalScale(vec3.one());
        }

        // Restore base (un-brightened) materials — release() never mutates the
        // shared base asset (clone-before-mutate), so a plain reassignment
        // is sufficient here; no re-clone needed.
        if (this.blobMesh) this.blobMesh.renderMeshVisual.mainMaterial = bodyBaseMaterialAsset;
        if (this.eyeLeftRmv) this.eyeLeftRmv.mainMaterial = eyeBaseMaterialAsset;
        if (this.eyeRightRmv) this.eyeRightRmv.mainMaterial = eyeBaseMaterialAsset;
    }

    /**
     * Reads the camera's CURRENT position/forward into habitatCenter /
     * habitatForwardYaw / wanderTargetY. Shared by resetToIdle() (habitat is
     * anchored once at spawn/reset) and the debug-only recenterHabitat()
     * (a manual re-anchor for preview/recording) — the habitat is otherwise
     * world-anchored, not continuously recentered on the camera every frame.
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
        this.habitatCenter = camPos;
        this.habitatForwardYaw = Math.atan2(camFwd.x, -camFwd.z);
        this.wanderTargetY = camPos.y + HABITAT_VERTICAL_OFFSET_CM;
    }

    private onUpdate(): void {
        if (!this.bodyObject || this.state === CreaturePresentationState.RELEASING) return;
        const dt = getDeltaTime();
        this.timeS += dt;

        if (this.blobMesh) {
            this.blobMesh.updateWobble(this.timeS);
        }

        if (this.state === CreaturePresentationState.IDLE) {
            this.updateIdle(dt);
        } else if (this.state === CreaturePresentationState.CHASING) {
            this.updateChasing(dt);
        }

        this.applyBodyScale(dt);
    }

    // ── IDLE: breathing (handled in applyBodyScale) + wander + glance ──────

    private updateIdle(dt: number): void {
        if (this.isGlancing) {
            this.updateGlance(dt);
            return; // movement paused during a glance for a clean, readable beat
        }

        this.glanceTimer -= dt;
        if (this.glanceTimer <= 0) {
            this.isGlancing = true;
            this.glanceElapsed = 0;
            return;
        }

        this.updateWander(dt);
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
                this.wanderPauseTimer = this.randomRange(WANDER_REPICK_PAUSE_MIN_S, WANDER_REPICK_PAUSE_MAX_S);
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
            WANDER_SPEED_CM_S,
            WANDER_MAX_ACCEL_CM_S2,
            WANDER_ARRIVAL_RADIUS_CM,
            WANDER_DEAD_ZONE_RADIUS_CM,
            dt,
        );
        this.velocity = result.velocity;
        this.sceneObject.getTransform().setWorldPosition(result.position);

        if (result.velocity.length > 0.5) {
            const dir = result.velocity.normalize();
            this.checkSquashStretch(dir);
            this.updateFacing(dir, dt);
        }
    }

    private updateGlance(dt: number): void {
        if (!this.bodyObject || !this.cameraObject) return;
        this.glanceElapsed += dt;

        const camPos = this.cameraObject.getTransform().getWorldPosition();
        const bodyPos = this.bodyObject.getTransform().getWorldPosition();
        const toCam = camPos.sub(bodyPos);
        if (toCam.length > 0.5) {
            this.updateFacing(toCam.normalize(), dt);
        }

        // Small hop: single up-down bump over GLANCE_HOP_DURATION_S, held briefly.
        let hopY = 0;
        if (this.glanceElapsed < GLANCE_HOP_DURATION_S) {
            const t = this.glanceElapsed / GLANCE_HOP_DURATION_S;
            hopY = GLANCE_HOP_HEIGHT_CM * Math.sin(t * Math.PI);
        }
        this.bodyObject.getTransform().setLocalPosition(new vec3(0, hopY, 0));

        const totalGlanceDuration = GLANCE_HOP_DURATION_S + GLANCE_HOLD_DURATION_S;
        if (this.glanceElapsed >= totalGlanceDuration) {
            this.isGlancing = false;
            this.glanceElapsed = 0;
            this.glanceTimer = this.randomRange(GLANCE_INTERVAL_MIN_S, GLANCE_INTERVAL_MAX_S);
            this.bodyObject.getTransform().setLocalPosition(vec3.zero());
        }
    }

    private pickWanderTarget(): vec3 {
        const halfArcRad = (HABITAT_ARC_HALF_ANGLE_DEG * Math.PI) / 180;
        const angleOffset = (Math.random() * 2 - 1) * halfArcRad;
        const angle = this.habitatForwardYaw + angleOffset;
        const dist = this.randomRange(HABITAT_RADIUS_MIN_CM, HABITAT_RADIUS_MAX_CM);

        // Reconstruct a direction vector from a yaw angle the same way faceDirection's
        // formula reads one back: yaw = atan2(dir.x, -dir.z) => dir = (sin(yaw), 0, -cos(yaw)).
        const dirX = Math.sin(angle);
        const dirZ = -Math.cos(angle);

        return new vec3(this.habitatCenter.x + dirX * dist, this.wanderTargetY, this.habitatCenter.z + dirZ * dist);
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
        // above CHASE_STOP_DISTANCE_CM, this alone keeps the creature at-or-beyond
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
        this.chaseRadiusCm = Math.max(radialResult.position.x, CHASE_STOP_DISTANCE_CM);
        if (this.chaseRadiusCm <= CHASE_STOP_DISTANCE_CM && this.chaseRadialVel < 0) {
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
            this.updateFacing(toCam.normalize(), dt);
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
        faceDirection(this.bodyObject, this.facingDir);
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

    /** Breathing pulse (always active, uniform) composed multiplicatively
     *  with a damped squash-then-stretch-then-settle envelope (anisotropic,
     *  triggered on direction change) — the two never overwrite each other. */
    private applyBodyScale(dt: number): void {
        if (!this.bodyObject) return;

        if (this.squashEnvelope > 0) {
            this.squashEnvelope = Math.max(0, this.squashEnvelope - dt / SQUASH_STRETCH_DURATION_S);
        }

        const breathe = 1 + BREATHE_AMPLITUDE * Math.sin(this.timeS * BREATHE_FREQUENCY_HZ * Math.PI * 2);

        const u = 1 - this.squashEnvelope; // 0 at trigger, 1 once settled
        const wave = Math.cos(u * Math.PI * 1.5) * (1 - u);
        const scaleY = 1 - SQUASH_STRETCH_AMOUNT * wave;
        const scaleXZ = 1 + SQUASH_STRETCH_AMOUNT * 0.5 * wave;

        this.bodyObject.getTransform().setLocalScale(new vec3(breathe * scaleXZ, breathe * scaleY, breathe * scaleXZ));
    }

    private randomRange(min: number, max: number): number {
        return min + Math.random() * (max - min);
    }
}
