/**
 * CreatureMovement — pure math helpers shared by CreatureBehavior's wander
 * and chase steering. No instance state, no SceneObject side effects other
 * than the explicit ones documented per function — kept separate from
 * CreatureBehavior so the state machine (IDLE/CHASING/RELEASING transitions,
 * public API) stays readable on its own.
 */

import { MAX_STEP_DT_S } from "../Config/CreatureConfig";

export interface SeekArriveResult {
    velocity: vec3;
    position: vec3;
}

/**
 * Classic seek-with-arrival steering: capped acceleration, capped max
 * speed, arrival-radius ramp-down, dead-zone snap-to-rest. Pure function —
 * does not mutate any SceneObject; the caller applies the returned
 * position/velocity.
 */
export function stepSeekArrive(
    currentPos: vec3,
    currentVelocity: vec3,
    targetPos: vec3,
    maxSpeed: number,
    maxAccel: number,
    arrivalRadius: number,
    deadZoneRadius: number,
    dt: number,
): SeekArriveResult {
    dt = Math.min(dt, MAX_STEP_DT_S);
    const toTarget = targetPos.sub(currentPos);
    const dist = toTarget.length;

    if (dist <= deadZoneRadius) {
        return { velocity: vec3.zero(), position: currentPos };
    }

    const dir = toTarget.uniformScale(1 / dist);
    const rampedSpeed = dist < arrivalRadius ? maxSpeed * clamp01(dist / arrivalRadius) : maxSpeed;
    const desiredVelocity = dir.uniformScale(rampedSpeed);

    let steering = desiredVelocity.sub(currentVelocity);
    const steeringLen = steering.length;
    const maxSteer = maxAccel * dt;
    if (steeringLen > maxSteer && steeringLen > 0.0001) {
        steering = steering.uniformScale(maxSteer / steeringLen);
    }

    let velocity = currentVelocity.add(steering);
    const speed = velocity.length;
    if (speed > maxSpeed) {
        velocity = velocity.uniformScale(maxSpeed / speed);
    }

    const position = currentPos.add(velocity.uniformScale(dt));
    return { velocity, position };
}

/**
 * yaw = atan2(dir.x, -dir.z). NEVER simplify to atan2(-dir.x, -dir.z) — that
 * only holds for pure +/-Z travel and flips 180 degrees on +/-X travel,
 * which wander/glance/chase all exercise.
 */
export function faceDirection(visual: SceneObject, dir: vec3): void {
    const yaw = Math.atan2(dir.x, -dir.z);
    visual.getTransform().setLocalRotation(quat.fromEulerAngles(0, yaw, 0));
}

export interface AngularSeekResult {
    angularVelocity: number;
    angleRad: number;
}

/**
 * Angular analogue of stepSeekArrive — same capped-acceleration / max-speed /
 * arrival-radius / dead-zone shape, but in radians with wraparound handled
 * via the shortest signed angular difference. Used to steer the chase
 * creature's ANGLE around the camera independently of its RADIAL distance
 * (see CreatureBehavior.updateChasing): decoupling the two means the
 * creature's distance from the camera never has to dip toward the center
 * while it turns to face a target that's on the opposite side, which a
 * single Cartesian point-to-point seek would do for a large starting angle
 * (and which then fights the hard-stop floor every frame, converging over
 * tens of seconds instead of a few — observed directly in testing).
 */
export function stepSeekArriveAngular(
    currentAngleRad: number,
    currentAngularVelocity: number,
    targetAngleRad: number,
    maxAngularSpeed: number,
    maxAngularAccel: number,
    arrivalRad: number,
    deadZoneRad: number,
    dt: number,
): AngularSeekResult {
    dt = Math.min(dt, MAX_STEP_DT_S);
    const diff = Math.atan2(Math.sin(targetAngleRad - currentAngleRad), Math.cos(targetAngleRad - currentAngleRad));
    const dist = Math.abs(diff);

    if (dist <= deadZoneRad) {
        return { angularVelocity: 0, angleRad: currentAngleRad };
    }

    const dir = diff / dist;
    const rampedSpeed = dist < arrivalRad ? maxAngularSpeed * clamp01(dist / arrivalRad) : maxAngularSpeed;
    const desiredVelocity = dir * rampedSpeed;

    let steering = desiredVelocity - currentAngularVelocity;
    const maxSteer = maxAngularAccel * dt;
    if (Math.abs(steering) > maxSteer && Math.abs(steering) > 0.0001) {
        steering = Math.sign(steering) * maxSteer;
    }

    let angularVelocity = currentAngularVelocity + steering;
    if (Math.abs(angularVelocity) > maxAngularSpeed) {
        angularVelocity = Math.sign(angularVelocity) * maxAngularSpeed;
    }

    const angleRad = currentAngleRad + angularVelocity * dt;
    return { angularVelocity, angleRad };
}

export function rotateAroundY(v: vec3, angleRad: number): vec3 {
    const c = Math.cos(angleRad);
    const s = Math.sin(angleRad);
    return new vec3(v.x * c + v.z * s, v.y, -v.x * s + v.z * c);
}

export function clamp01(v: number): number {
    return Math.max(0, Math.min(1, v));
}

export function findChildByName(parent: SceneObject, name: string): SceneObject | null {
    const count = parent.getChildrenCount();
    for (let i = 0; i < count; i++) {
        const child = parent.getChild(i);
        if (child.name === name) return child;
    }
    return null;
}
