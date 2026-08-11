/**
 * CreatureConfig — every tunable constant for the emotional-core creature
 * piece (habitat/chase/breathing/wobble/wander/squash-stretch/glance/
 * hesitation/lathe/eye/release numbers).
 *
 * Per CLAUDE.md ("All constants in one config file (thresholds, distances,
 * speeds, timings)") this file is the single source of truth — values are
 * NOT duplicated as per-component @input fields in the Inspector, so there
 * is exactly one place to retune behavior and no drift between an Inspector
 * override and this file. Future pieces (StateEngine's CHASE_THRESHOLD,
 * etc.) should extend this same file rather than starting a second one.
 *
 * All spatial constants are expressed in CENTIMETERS (Lens Studio world
 * units — see AGENTS.md) even though the approved design doc described
 * some of them with "_M" suffixes assuming meters; e.g. a 1.0-1.5m habitat
 * becomes HABITAT_RADIUS_MIN_CM = 100 / HABITAT_RADIUS_MAX_CM = 150.
 */

// ── Habitat (world-space wander zone, distance from the user) ──────────────
export const HABITAT_RADIUS_MIN_CM = 100; // 1.0m
export const HABITAT_RADIUS_MAX_CM = 150; // 1.5m
/** Wander stays within a forward-facing arc so the creature never drifts behind the user. */
export const HABITAT_ARC_HALF_ANGLE_DEG = 60;
/** Fixed vertical offset (cm) below the camera's spawn-time height the creature wanders at. */
export const HABITAT_VERTICAL_OFFSET_CM = -10;

// ── Chase ────────────────────────────────────────────────────────────────
export const CHASE_DISTANCE_MIN_CM = 110; // 1.1m
export const CHASE_DISTANCE_MAX_CM = 130; // 1.3m
export const CHASE_SIDE_OFFSET_MIN_DEG = 8;
export const CHASE_SIDE_OFFSET_MAX_DEG = 12;
export const CHASE_STOP_DISTANCE_CM = 100; // 1.0m hard stop, never gets closer
export const MAX_SPEED_CM_S = 50; // 0.5 m/s hard cap (CLAUDE.md)
export const CHASE_MAX_ACCEL_CM_S2 = 90;
export const CHASE_ARRIVAL_RADIUS_CM = 8;
export const CHASE_DEAD_ZONE_RADIUS_CM = 3;
/**
 * Angular counterparts of the radial arrival radius / dead zone above, used
 * by the angular seek that steers the creature's position AROUND the camera
 * (see CHASE_ANGULAR note below). Expressed directly in degrees rather than
 * derived from the linear constants, since the "how close counts as arrived"
 * feel is a separate tuning knob from "how fast can it get there."
 */
export const CHASE_ANGULAR_ARRIVAL_DEG = 5;
export const CHASE_ANGULAR_DEAD_ZONE_DEG = 1.5;
/** Secondary short-timer layer so the approach isn't a straight beeline. */
export const CHASE_HESITATION_INTERVAL_MIN_S = 1.0;
export const CHASE_HESITATION_INTERVAL_MAX_S = 2.0;
/**
 * Chase steering is polar (radius + angle around the camera), decoupled so
 * the hard stop can never be approached by cutting through the middle — see
 * CreatureBehavior.updateChasing. Hesitation is therefore an angular dart
 * (a temporary offset added to the target angle) rather than a Cartesian
 * position offset.
 */
export const CHASE_HESITATION_ANGLE_DEG = 6;
export const CHASE_HESITATION_DURATION_S = 0.5;

// ── Breathing (always active, every state except RELEASING) ────────────────
export const BREATHE_AMPLITUDE = 0.03; // ~3% uniform scale pulse
export const BREATHE_FREQUENCY_HZ = 0.35;

// ── Organic per-vertex wobble (subtler than breathing) ──────────────────────
/**
 * Single on/off switch for the per-vertex wobble. This is the main perf risk
 * once multiple creatures (up to 6) run simultaneously — each enabled
 * creature does a per-frame CPU vertex loop + MeshBuilder.updateMesh() call.
 * Flip this to false to cut both entirely, with no other code changes:
 * BlobMeshBuilder.updateWobble() no-ops before the loop and before
 * updateMesh() when this is false. CreatureBehavior always calls
 * updateWobble() unconditionally — the gating lives here, not in behavior
 * code, so toggling this one constant is the whole change.
 */
export const WOBBLE_ENABLED = true;
export const WOBBLE_AMPLITUDE_CM = 0.12;
export const WOBBLE_FREQUENCY_HZ = 0.45;
/** Phase offset per lathe profile ring (height index) — keeps each ring's wobble
 *  rotationally symmetric (no pole cracking) while still rippling top-to-bottom. */
export const WOBBLE_PHASE_STEP = 0.9;

// ── Wander (idle locomotion) ────────────────────────────────────────────────
export const WANDER_SPEED_CM_S = 16;
export const WANDER_MAX_ACCEL_CM_S2 = 40;
export const WANDER_ARRIVAL_RADIUS_CM = 6;
export const WANDER_DEAD_ZONE_RADIUS_CM = 2;
export const WANDER_REPICK_PAUSE_MIN_S = 1.5;
export const WANDER_REPICK_PAUSE_MAX_S = 4.0;

// ── Squash & stretch (on direction change, composes multiplicatively with breathing) ──
export const SQUASH_STRETCH_AMOUNT = 0.1; // ~10% axis deviation at peak
export const SQUASH_STRETCH_DURATION_S = 0.35;
/** Dot product of (prevDir, newDir) below this = "direction changed enough to trigger". */
export const SQUASH_STRETCH_DIRECTION_DOT_THRESHOLD = 0.4;

// ── Glance-at-camera (IDLE only) ────────────────────────────────────────────
export const GLANCE_INTERVAL_MIN_S = 5;
export const GLANCE_INTERVAL_MAX_S = 10;
export const GLANCE_HOP_HEIGHT_CM = 1.2;
export const GLANCE_HOP_DURATION_S = 0.4;
export const GLANCE_HOLD_DURATION_S = 0.6;

// ── Facing / rotation smoothing ─────────────────────────────────────────────
/** How quickly Body's facing direction eases toward the desired direction (per second). */
export const FACE_TURN_RATE_PER_S = 6;

// ── Integration safety ──────────────────────────────────────────────────────
/**
 * Upper bound on the dt fed into stepSeekArrive's position integration.
 * Preview stalls (e.g. an editor hitch while MCP tool calls run) can produce
 * one very large getDeltaTime() frame; without this clamp, position +=
 * velocity * dt lets a single such frame teleport the creature far past its
 * capped-acceleration/max-speed envelope — a direct violation of the
 * spatial-comfort contract (CLAUDE.md). Clamping caps the worst-case
 * per-frame displacement at MAX_SPEED_CM_S * MAX_STEP_DT_S regardless of how
 * long any one frame actually took; a stall just costs a few catch-up frames
 * instead of a jump.
 */
export const MAX_STEP_DT_S = 1 / 15;

// ── Lathe geometry (egg/teardrop silhouette, ~16cm tall x ~14cm wide) ──────
export const LATHE_SEGMENTS = 18;
/** [radius_cm, height_cm] points, bottom pole -> equator bulge -> top pole. Centered on Y=0. */
export const BLOB_PROFILE: [number, number][] = [
    [0.0, -8.0],
    [3.2, -7.4],
    [6.0, -5.0],
    [7.0, -1.5],
    [6.6, 1.5],
    [5.2, 4.5],
    [3.0, 6.6],
    [0.0, 8.0],
];
/** Warm cream/peach, unlit — matches the "cat-like, never monstrous" tone. */
export const BLOB_COLOR: [number, number, number, number] = [0.96, 0.82, 0.68, 1.0];

// ── Eyes (simple dark unlit pupils, fixed on Body's local -Z front) ────────
export const EYE_RADIUS_CM = 0.9;
export const EYE_OFFSET_X_CM = 2.0;
export const EYE_OFFSET_Y_CM = 2.5;
export const EYE_OFFSET_Z_CM = -6.7;
export const EYE_COLOR: [number, number, number, number] = [0.12, 0.1, 0.09, 1.0];

// ── Release (one-shot, idempotent — see CreatureBehavior.release()) ────────
export const RELEASE_DURATION_S = 1.5;
export const RELEASE_PARTICLE_COUNT = 30;
export const RELEASE_PARTICLE_SPEED_CM_S = 8;
export const RELEASE_PARTICLE_DRIFT_CM = 4;
export const RELEASE_PARTICLE_SIZE_CM = 0.5;
/** Lerp factor (0-1) toward white applied to the brightened body/eye/particle color. */
export const RELEASE_BRIGHTEN_LERP = 0.5;
