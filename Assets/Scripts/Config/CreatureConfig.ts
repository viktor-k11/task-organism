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
/** Three-creature demo habitat: fixed camera-relative homes, safely inside Preview. */
export const HABITAT_HOME_DEPTH_CM = 240;
export const HABITAT_HOME_LATERAL_SPACING_CM = 18;
export const HABITAT_HOME_GROUP_LATERAL_CM = -24;
export const HABITAT_HOME_SIDE_DEPTH_OFFSET_CM = 6;
export const HABITAT_HOME_WANDER_RADIUS_CM = 3;
export const HABITAT_HOME_FLOOR_Y_CM = -8;
/** Presentation height: ~28 cm calm, easing toward ~37 cm while urgent. */
export const HABITAT_VISUAL_SCALE = 0.68;
export const CHASE_VISUAL_SCALE = 0.95;
export const PRESENTATION_SCALE_EASE_PER_S = 2.8;

// ── Chase ────────────────────────────────────────────────────────────────
export const CHASE_DISTANCE_MIN_CM = 110; // 1.1m
export const CHASE_DISTANCE_MAX_CM = 130; // 1.3m
export const CHASE_SIDE_OFFSET_MIN_DEG = 0;
export const CHASE_SIDE_OFFSET_MAX_DEG = 0;
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
export const CHASE_LOOK_PAUSE_S = 0.3;
export const CHASE_ANTICIPATION_S = 0.28;
export const CHASE_ANTICIPATION_DIP_CM = 1.4;

// ── Breathing (always active, every state except RELEASING) ────────────────
/**
 * Per-state breathing profile — deliberately overdone on the first pass
 * (per design direction: exaggerate first, dial down later once the
 * contrast is confirmed legible). CALM = slow and deep. URGENT = fast and
 * shallow (a visible pant). CHASING/INTERACTING = intermediate rate but
 * held tighter (less depth) than CALM — reads as tense, not relaxed.
 */
export const BREATHE_CALM_AMPLITUDE = 0.06;
export const BREATHE_CALM_FREQUENCY_HZ = 0.18;
export const BREATHE_URGENT_AMPLITUDE = 0.015;
export const BREATHE_URGENT_FREQUENCY_HZ = 1.4;
export const BREATHE_CHASE_AMPLITUDE = 0.03;
export const BREATHE_CHASE_FREQUENCY_HZ = 0.8;

// ── Organic per-vertex wobble (subtler than breathing) ──────────────────────
// Kept for BlobMeshBuilder.ts, which is retained in the repo as the original
// procedural creature (not currently wired into CreatureBehavior — see
// CreatureBody.ts / CreaturePetVisual.ts for the active visual).
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
/**
 * Split into CALM vs URGENT parameter sets so the two behavior states read as
 * distinct motion, not just distinct labels (see CreatureBehavior.setUrgent /
 * updateWander). CALM = settled: slow, small drift, long pauses between
 * moves. URGENT = restless: quicker, more frequent retargeting, shorter
 * pauses — but still governed by the same seek-arrive shape and the same
 * habitat/home-anchor bounds, so it never leaves the habitat or approaches
 * chase speeds.
 */
export const WANDER_CALM_SPEED_CM_S = 7;
export const WANDER_CALM_MAX_ACCEL_CM_S2 = 16;
export const WANDER_CALM_REPICK_PAUSE_MIN_S = 3.5;
export const WANDER_CALM_REPICK_PAUSE_MAX_S = 8.0;
/** Fraction of the home wander radius actually used while CALM — most of the
 *  disc is "reachable" but rarely visited, so drift reads as small. */
export const WANDER_CALM_RADIUS_SCALE = 0.45;

export const WANDER_URGENT_SPEED_CM_S = 24;
export const WANDER_URGENT_MAX_ACCEL_CM_S2 = 70;
export const WANDER_URGENT_REPICK_PAUSE_MIN_S = 0.25;
export const WANDER_URGENT_REPICK_PAUSE_MAX_S = 0.85;
/** Slightly wider than the base home radius — agitated, but CreatureBehavior
 *  still clamps every wander target inside the shared habitat bounds. */
export const WANDER_URGENT_RADIUS_SCALE = 1.25;

export const WANDER_ARRIVAL_RADIUS_CM = 6;
export const WANDER_DEAD_ZONE_RADIUS_CM = 2;

// ── Squash & stretch (on direction change, composes multiplicatively with breathing) ──
export const SQUASH_STRETCH_AMOUNT = 0.18;
export const SQUASH_STRETCH_DURATION_S = 0.35;
export const BODY_MOVE_TILT_DEG = 8;
export const BODY_SECONDARY_SWAY_DEG = 2.5;
/** Dot product of (prevDir, newDir) below this = "direction changed enough to trigger". */
export const SQUASH_STRETCH_DIRECTION_DOT_THRESHOLD = 0.4;

// ── Posture (non-uniform Body scale, composes with breathing/squash-stretch) ─
/**
 * Per-state resting posture, expressed as height (Y) vs width (XZ) scale
 * factors layered under breathing. CALM settles lower and wider (relaxed,
 * grounded). URGENT sits taller and narrower, plus a fast continuous tremor
 * on top. CHASING is intermediate — alert but not trembling. No new
 * geometry: all three channels multiply into the same Body local scale.
 * Overdone deliberately on the first pass, same rationale as breathing.
 */
export const POSTURE_EASE_PER_S = 3.0;
export const POSTURE_CALM_HEIGHT_SCALE = 0.86;
export const POSTURE_CALM_WIDTH_SCALE = 1.14;
export const POSTURE_URGENT_HEIGHT_SCALE = 1.18;
export const POSTURE_URGENT_WIDTH_SCALE = 0.90;
export const POSTURE_CHASE_HEIGHT_SCALE = 1.08;
export const POSTURE_CHASE_WIDTH_SCALE = 0.97;
/** Fast small scale wobble, URGENT only — reads as a nervous tremor. */
export const POSTURE_URGENT_TREMOR_AMPLITUDE = 0.045;
export const POSTURE_URGENT_TREMOR_HZ = 5.5;

// ── Gaze (strongest state signal — where the creature looks, IDLE only) ────
/**
 * CALM looks around slowly, biased AWAY from the camera (a wide, unhurried
 * sweep centered on the habitat's far side). URGENT keeps turning back to
 * face the camera directly and holds that look, with a fast small tremor
 * layered on top so "locked on" also reads as anxious rather than static.
 * CHASING/INTERACTING keep their own existing camera-lock (unchanged).
 * Overdone deliberately on the first pass, same rationale as breathing.
 */
export const GAZE_CALM_YAW_SPEED_DEG_S = 18;
export const GAZE_CALM_DRIFT_RANGE_DEG = 85;
export const GAZE_CALM_DRIFT_HZ = 0.05;
export const GAZE_URGENT_YAW_SPEED_DEG_S = 180;
export const GAZE_URGENT_TREMOR_DEG = 8;
export const GAZE_URGENT_TREMOR_HZ = 3.2;

// ── Color tint (per-instance material baseColor shift, IDLE + CHASING) ─────
/**
 * Warm-shift the body material from the neutral BLOB_COLOR toward these
 * targets as urgency rises. Applied to a per-instance material clone (see
 * CreatureBehavior.resetToIdle) so it never bleeds into sibling creatures
 * sharing the same base asset. Overdone deliberately on the first pass.
 */
export const TINT_EASE_PER_S = 3.0;
export const TINT_URGENT_COLOR: [number, number, number, number] = [0.97, 0.42, 0.20, 1.0];
export const TINT_CHASE_COLOR: [number, number, number, number] = [0.98, 0.30, 0.18, 1.0];

// ── Facing / rotation smoothing ─────────────────────────────────────────────
/** How quickly Body's facing direction eases toward the desired direction (per second). */
export const FACE_TURN_RATE_PER_S = 4;
export const CHASE_MAX_YAW_SPEED_DEG_S = 90;

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

// ── Task urgency / attention (derived, never persisted) ──────────────────
/** Normal tasks cross the chase threshold after one day; tests advance DemoClock. */
export const URGENCY_AGE_WINDOW_MS = 24 * 60 * 60 * 1000;
export const CHASE_THRESHOLD = 1;
export const HIGH_IMPORTANCE_URGENCY_BONUS = 0.5;

// ── Gate 3 input / interaction ───────────────────────────────────────────
export const RESOLVE_HOLD_DURATION_S = 1.5;
export const LATER_SNOOZE_DURATION_MS = 15 * 60 * 1000;
export const HABITAT_LABEL_MAX_CHARS = 18;
export const SELECTION_LINE_MAX_CHARS = 30;
export const TASK_SELECTION_PANEL_Y_CM = 25;

// ── Lathe geometry (egg/teardrop silhouette, ~16cm tall x ~14cm wide) ──────
// Kept for BlobMeshBuilder.ts (see the wobble section above — same status).
export const LATHE_SEGMENTS = 80;
export const VISUAL_BASELINE_SCALE = 0.88;
/** [radius_cm, height_cm, x_offset_cm, z_offset_cm] — smooth asymmetric bean, 39cm tall. */
export const BLOB_PROFILE: [number, number, number?, number?][] = [
    [0.0, -19.0, -0.8, 0.0],
    [9.5, -19.0, -0.7, 0.0],
    [12.0, -18.4, -0.6, -0.05],
    [14.0, -17.2, -0.5, -0.1],
    [15.2, -15.5, -0.35, -0.25],
    [16.0, -13.5, -0.2, -0.4],
    [16.5, -11.3, 0.0, -0.6],
    [16.8, -9.0, 0.2, -0.8],
    [16.75, -6.5, 0.45, -1.05],
    [16.5, -4.0, 0.7, -1.3],
    [16.1, -1.5, 0.95, -1.55],
    [15.6, 1.0, 1.2, -1.8],
    [15.05, 3.5, 1.4, -2.05],
    [14.4, 6.0, 1.6, -2.3],
    [13.65, 8.3, 1.75, -2.5],
    [12.8, 10.5, 1.9, -2.7],
    [11.8, 12.5, 1.95, -2.85],
    [10.7, 14.2, 2.0, -3.0],
    [9.5, 15.7, 1.95, -3.05],
    [8.1, 17.0, 1.8, -3.1],
    [6.2, 18.2, 1.6, -3.1],
    [4.2, 19.1, 1.3, -3.0],
    [2.1, 19.75, 1.0, -2.9],
    [0.0, 20.0, 0.8, -2.8],
];
/** Saturated amber-gold, unlit — matches the "cat-like, never monstrous" tone.
 *  Also the neutral CALM baseline for the /build-mesh PetCreature body tint.
 *  Retuned from the original pale cream/peach [0.84, 0.62, 0.49] after the
 *  additive-compositing investigation (see prompts.md): this Preview adds
 *  rendered light on top of the background rather than occluding it, so a
 *  light, low-saturation color washes out against bright backdrops. A/B'd
 *  against terracotta [0.68, 0.32, 0.16] and rosewood [0.55, 0.18, 0.22] —
 *  this read clearest against both a bright white backdrop and a dark floor. */
export const BLOB_COLOR: [number, number, number, number] = [0.75, 0.48, 0.1, 1.0];

/**
 * Half the /build-mesh PetCreature GLB's authored height (AABB 33.4 x 37.0 x
 * 33.7 cm, ground-seated at import). CreatureBody.ts re-centers the
 * instantiated prefab by this amount so Body's local Y=0 lands on the
 * mesh's vertical CENTER — matching the old blob's convention so the
 * habitat-floor / chase-Y math elsewhere keeps working unchanged. Also used
 * to place the habitat floor plane's Y at the mesh's actual foot level.
 */
export const PET_CREATURE_HALF_HEIGHT_CM = 18.5;

/**
 * Ready-made Sketchfab dog/cat GLBs (Assets/3d assets/) — CreaturePetVisual.ts
 * wraps whichever one a creature slot uses. Both are rigged/animated source
 * assets used here as STATIC meshes (bind pose only, no animation played);
 * both raw imports face world +Z by default (verified empirically with a
 * world-space marker) and needed a runtime 180° yaw correction to match the
 * -Z front convention faceDirection assumes — same "fix the model, not the
 * helper" approach as PetCreature, but applied as a fixed wrapper rotation
 * at instantiation time rather than baked into the GLB bytes: the
 * skill's normalize_glb.js vertex-rewrite miscomputed scale on these
 * gltf-transform-simplified files (verified: AABB collapsed to ~0.5cm after
 * a --max-dim pass), so scale/rotation are applied at runtime instead —
 * the wrapper-pattern the skill itself documents as the safe fallback.
 *
 * Both are scaled to the SAME target height (real dogs are taller than
 * cats, but matching heights keeps one shared half-height constant valid
 * for every creature slot regardless of which model it uses, so the
 * habitat-floor / chase-Y math and the shared floor plane below both stay
 * correct without per-species branching).
 */
export const READYMADE_PET_TARGET_HEIGHT_CM = 34;
export const READYMADE_PET_HALF_HEIGHT_CM = READYMADE_PET_TARGET_HEIGHT_CM / 2;
export const READYMADE_PET_YAW_CORRECTION_DEG = 180;
/** localScale to apply to the instantiated prefab root (already at the
 *  default ×100 GLB-import scale) so its displayed height becomes
 *  READYMADE_PET_TARGET_HEIGHT_CM. Computed from each source GLB's
 *  measured height at the default ×100 scale: dog 205.2cm, cat 84.6cm. */
export const DOG_DISPLAY_SCALE = (READYMADE_PET_TARGET_HEIGHT_CM / 205.2) * 100;
export const CAT_DISPLAY_SCALE = (READYMADE_PET_TARGET_HEIGHT_CM / 84.6) * 100;

/** Whole-body growth: an ignored task's creature scales from 1.0 up to this
 *  cap as urgency climbs from 0 toward CHASE_THRESHOLD, then holds — a
 *  continuous, one-way-legible channel that works on any mesh (uniform
 *  transform scale), unlike the CALM/URGENT/CHASE breathing/posture/gaze
 *  channels above it. See CreatureBehavior.setUrgencyLevel01. */
export const GROWTH_SCALE_MAX = 1.25;
export const GROWTH_EASE_PER_S = 2.0;

// ── Eyes (simple dark unlit pupils, fixed on Body's local -Z front) ────────
// Big forward-facing eyes, low on the face — Body-local Y is recentered so
// 0 = the PetCreature mesh's vertical center (see CreatureBody.ts); the head
// spans roughly Y=-0.5 (neck) to Y=+18.5 (crown), so "low on the face" sits
// in the lower third of that range.
export const EYE_RADIUS_CM = 3.1;
export const EYE_OFFSET_Y_CM = 5.5;
export const EYE_OFFSET_Z_CM = -15.0;
export const EYE_COLOR: [number, number, number, number] = [0.12, 0.1, 0.09, 1.0];
export const BLINK_INTERVAL_MIN_S = 2.8;
export const BLINK_INTERVAL_MAX_S = 5.5;
export const BLINK_DURATION_S = 0.16;

// ── Expressive face (the single per-state value CreatureBehavior computes —
// emotionalProfile() — drives every channel below together, so calm/urgent/
// chasing read as one coherent face rather than independently-tuned parts
// that could drift out of sync). Legibility first, per design direction:
// eyelid closure alone should already read clearly at a glance.
export const EXPRESSION_EASE_PER_S = 4.0;

/** Upper-eyelid resting closure: 0 = wide open, 1 = fully shut. Composes
 *  with the existing blink reflex via Math.max (see CreatureEyes.
 *  updateExpression) — a full blink still fully closes the eye even from a
 *  half-lidded CALM resting state. */
export const EYELID_CALM_CLOSURE = 0.5;
export const EYELID_URGENT_CLOSURE = 0.0;
export const EYELID_CHASE_CLOSURE = 0.0;

/** Uniform multiplier on top of each eye's existing baseScale — widens with
 *  intensity without touching the baked-in left/right size asymmetry. */
export const EYE_SCALE_CALM = 0.9;
export const EYE_SCALE_URGENT = 1.18;
export const EYE_SCALE_CHASE = 1.25;

/** Half-spacing (cm) from Body center — replaces the old fixed
 *  EYE_OFFSET_X_CM with a per-state, eased value. CALM baseline is the
 *  narrowest (relaxed, less alert); intensity widens the gap. Wide-set eyes
 *  are one of the "readable at 1.3m" proportions, so the baseline is wider
 *  than the old blob's fixed 4.2cm. */
export const EYE_SPACING_CALM_CM = 5.5;
export const EYE_SPACING_URGENT_CM = 6.5;
export const EYE_SPACING_CHASE_CM = 7.0;

/** Body-local pitch bias (degrees), composes with the existing
 *  motion-driven pitch wobble in updateFaceAndSecondaryMotion — CALM leans
 *  back/down (slump), URGENT/CHASING lean forward (tense, anticipating). */
export const LEAN_CALM_PITCH_DEG = -4;
export const LEAN_URGENT_PITCH_DEG = 6;
export const LEAN_CHASE_PITCH_DEG = 9;

/**
 * Optional mouth — a short chain of small overlapping flattened beads that
 * reads as a single line and bows into a smile (positive curve) or frown
 * (negative curve): CALM content, URGENT worried, CHASING eager. Single
 * on/off switch (WOBBLE_ENABLED-style) so it can be cut with no other code
 * changes if it doesn't read well before the visual pass lands.
 */
export const MOUTH_ENABLED = true;
export const MOUTH_SEGMENT_COUNT: number = 5;
export const MOUTH_WIDTH_CM = 5.0;
export const MOUTH_BEAD_RADIUS_CM = 1.3;
export const MOUTH_OFFSET_Y_CM = 2.0;
export const MOUTH_OFFSET_Z_CM = -17.5;
export const MOUTH_CURVE_HEIGHT_CM = 1.6;
export const MOUTH_COLOR: [number, number, number, number] = [0.42, 0.20, 0.18, 1.0];
export const MOUTH_CURVE_CALM = 0.35;
export const MOUTH_CURVE_URGENT = -0.45;
export const MOUTH_CURVE_CHASE = 0.55;

// ── Release (one-shot, idempotent — see CreatureBehavior.release()) ────────
export const RELEASE_DURATION_S = 1.5;
export const RELEASE_PARTICLE_COUNT = 30;
export const RELEASE_PARTICLE_SPEED_CM_S = 8;
export const RELEASE_PARTICLE_DRIFT_CM = 4;
export const RELEASE_PARTICLE_SIZE_CM = 0.5;
/** Lerp factor (0-1) toward white applied to the brightened body/eye/particle color. */
export const RELEASE_BRIGHTEN_LERP = 0.5;
