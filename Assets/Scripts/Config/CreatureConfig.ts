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
/** Fallback ground/floor Y (cm, camera-relative) used only when a creature has
 *  no explicit habitat home configured (setHabitatHome was never called) —
 *  see GROUND_Y_OFFSET_CM below for the demo's actual shared floor reference. */
export const HABITAT_VERTICAL_OFFSET_CM = -10;
/** Three-creature demo habitat: fixed camera-relative homes, safely inside Preview. */
export const HABITAT_HOME_DEPTH_CM = 240;
/**
 * Widened from 18 so URGENT roaming (WANDER_URGENT_RADIUS_CM) has somewhere
 * to go: at 18cm the three homes were nearly touching, and any roam worth
 * seeing would have walked neighbours through each other.
 *
 * Upper bound is the display FOV, not comfort: spacing + roam radius must
 * keep the OUTER creatures inside roughly +/-58cm of lateral offset (measured
 * in Preview at HABITAT_HOME_DEPTH_CM, leaving room for body width), or they
 * clip against the edge of the additive render region mid-walk. 36 + 16 = 52.
 */
export const HABITAT_HOME_LATERAL_SPACING_CM = 36;
/**
 * Group centered on the habitat forward axis. Previously -24, which shifted
 * all three creatures left; harmless when they sat 18cm apart, but once
 * spacing widened for URGENT roaming it pushed the leftmost creature past the
 * display's FOV edge (measured in Preview: the additive render region ends at
 * about +/-70cm of lateral offset at HABITAT_HOME_DEPTH_CM). Centering buys
 * back the asymmetric half.
 */
export const HABITAT_HOME_GROUP_LATERAL_CM = 0;
export const HABITAT_HOME_SIDE_DEPTH_OFFSET_CM = 6;
export const HABITAT_HOME_WANDER_RADIUS_CM = 3;
/**
 * THE single shared ground/floor reference (cm, camera-relative — added to
 * Camera Object's world Y). HabitatFloor's disc and every creature's
 * rendered foot line both derive from this ONE constant and nothing else,
 * so moving it moves them together — see HabitatFloor.ts and
 * CreatureBehavior.recomputeHabitatOrigin / updatePresentationScale.
 *
 * Root cause this replaces (renamed from HABITAT_HOME_FLOOR_Y_CM): the old
 * value was consumed as the creature's MESH-CENTER height (MovementRoot sat
 * at camY + offset, and the mesh's vertical center — not its feet — was
 * placed there), while HabitatFloor independently re-derived a SEPARATE
 * "floor" Y by subtracting a flat READYMADE_PET_HALF_HEIGHT_CM from that
 * same base offset — a correction that ignored the creature's actual
 * presentation scale (0.68 CALM / 0.95 CHASE / whole-body growth on top).
 * The two numbers only coincidentally lined up for one specific Preview
 * environment/camera height; switching environments changed the effective
 * camera-to-floor relationship and exposed the drift as creatures floating
 * or sinking. Now MovementRoot's world Y IS this constant directly (the
 * literal floor line), and CreatureBehavior.updatePresentationScale
 * compensates VisualRoot's own local position every frame so the rendered
 * feet land exactly there regardless of current scale — see that method's
 * comment for the pivot math.
 *
 * Why it is derived from eye height rather than hand-tuned: Lens Studio's
 * Interactive Preview environments are backdrop, not scene-graph objects, so
 * nothing in the Lens can query where their floor actually is — there is no
 * detection path (WorldQueryModule has nothing to hit-test against here, and
 * CLAUDE.md rules out device-only verification this week). What IS reliable
 * across every one of those rooms is that each is authored around a camera
 * at standing human eye height. Anchoring to that gives a ground line that
 * lands on the real floor in any environment, instead of an arbitrary offset
 * that only lined up with one room's furniture by coincidence — which is
 * exactly how the previous value read as "planted" in Evening Room and as
 * floating everywhere else.
 */
export const EYE_HEIGHT_CM = 150;
export const GROUND_Y_OFFSET_CM = -EYE_HEIGHT_CM;
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
 * Per-state breathing profile. The first pass was deliberately overdone
 * ("exaggerate first, dial down once the contrast is legible"); this is the
 * dial-down, driven by measurement rather than taste.
 *
 * Breathing does not only pulse the silhouette — applyBodyScale's base-pivot
 * compensation converts any Y-scale change into a vertical TRANSLATION of
 * READYMADE_PET_HALF_HEIGHT_CM (17cm) * (finalY - 1), so amplitude here is
 * really a bob height. At the old CALM 0.06, with POSTURE_CALM_HEIGHT_SCALE
 * 0.86, finalY swung 0.808..0.912 and the body rose and fell
 * 1.76 cm peak-to-peak — verified against runtime samples of Body.localPosition
 * (-3.076 and -1.786). Plus a 12% peak-to-peak width pulse. That is a lot of
 * motion for something that is supposed to read as settled.
 *
 * 0.018 puts the CALM bob at ~0.53 cm peak-to-peak, still visibly alive at
 * 0.18 Hz (a 5.6 s cycle) but well under the threshold where it reads as
 * movement rather than breathing.
 */
export const BREATHE_CALM_AMPLITUDE = 0.018;
export const BREATHE_CALM_FREQUENCY_HZ = 0.18;
/** URGENT pants faster, so amplitude has to be smaller to keep the same bob
 *  budget: 0.012 at POSTURE_URGENT_HEIGHT_SCALE 1.18 is ~0.48 cm. Frequency
 *  pulled 1.4 -> 1.1 Hz — fast enough to read as a pant, slow enough not to
 *  read as a vibration. */
export const BREATHE_URGENT_AMPLITUDE = 0.012;
export const BREATHE_URGENT_FREQUENCY_HZ = 1.1;
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
/**
 * Fraction of the home wander radius actually used while CALM. At the old
 * 0.45 (± up to 1.35cm from the home anchor), two consecutive repicks could
 * land up to ~2.7cm apart — over WANDER_DEAD_ZONE_RADIUS_CM (2cm) — so every
 * repick (every 3.5-8s) visibly walked the creature to a new nearby spot:
 * read as continuous drift, not "settled." 0 makes every CALM wander target
 * the home anchor itself, so once the creature arrives it never receives a
 * new target worth moving for — reaches its spot and stays, full stop. (A
 * task's URGENT/CHASE presentation is unaffected — those keep their own
 * distinct radius scales below.)
 */
export const WANDER_CALM_RADIUS_SCALE = 0;

/**
 * URGENT is the "actually walks around" state — the clearest state signal in
 * the scene, and the contrast partner to CALM's total stillness.
 *
 * Speed is deliberately LOWER than the old 24: these are static meshes with
 * no leg animation, so the faster they translate the more they read as
 * gliding props. 14 cm/s crosses the roam radius in ~1.5-3s, slow enough that
 * the walk bob (WALK_BOB_* below) sells the footfalls, and far under the
 * 50 cm/s comfort cap. Accel is likewise softened from 70 so departures and
 * arrivals ease instead of snapping.
 */
export const WANDER_URGENT_SPEED_CM_S = 14;
export const WANDER_URGENT_MAX_ACCEL_CM_S2 = 26;
/**
 * Pause between walks. The old 0.25-0.85s retargeted almost continuously,
 * which read as jitter rather than intent. 1.2-3.0s gives a legible
 * walk -> stop -> look -> walk rhythm.
 */
export const WANDER_URGENT_REPICK_PAUSE_MIN_S = 1.2;
export const WANDER_URGENT_REPICK_PAUSE_MAX_S = 3.0;
/**
 * ABSOLUTE roam radius (cm) around the creature's home anchor while URGENT —
 * not a multiple of HABITAT_HOME_WANDER_RADIUS_CM, which is a 3cm
 * settle-jitter figure. The old 1.25x of that gave a 3.75cm roam: at habitat
 * distance under 1 degree of arc, i.e. the micro-drift this replaces. 16cm is
 * roughly two-thirds of a body length, so a walk is unmistakably a walk, while
 * still keeping the outer creatures inside the display FOV (see
 * HABITAT_HOME_LATERAL_SPACING_CM) and leaving a gap between neighbours.
 */
export const WANDER_URGENT_RADIUS_CM = 16;

export const WANDER_ARRIVAL_RADIUS_CM = 6;
export const WANDER_DEAD_ZONE_RADIUS_CM = 2;

// ── Walk bob (movement-gated vertical bounce) ──────────────────────────────
/**
 * The pet meshes are static — no leg rig — so pure translation reads as a
 * prop sliding across the floor. A small vertical bounce locked to travel
 * speed supplies the missing footfall cue and the motion reads as walking.
 *
 * Strictly gated by current speed, so this does NOT reintroduce the CALM
 * vertical bob that was removed earlier: a settled creature has zero
 * velocity, hence zero bob, hence feet flat on the ground line. It rides on
 * top of applyBodyScale's base-pivot compensation rather than replacing it.
 */
export const WALK_BOB_AMPLITUDE_CM = 1.1;
/** Bob cycles per second per cm/s of travel — cadence scales with speed, so
 *  the bounce stays phase-locked to distance covered (14 cm/s -> ~1.3 Hz,
 *  two footfalls per cycle). */
export const WALK_BOB_HZ_PER_CM_S = 0.093;
/** Speed (cm/s) at which the bob reaches full amplitude. */
export const WALK_BOB_FULL_SPEED_CM_S = 12;

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
/**
 * DISABLED (0). This was the "nervous tremor" channel: a +/-4.5% scale wobble
 * at 5.5 Hz, URGENT only. Through applyBodyScale's base-pivot compensation it
 * became a ~1.8 cm vertical shake five and a half times per second, on top of
 * a 9% width pulse at the same rate — which is what read as broken rather
 * than restless in the recording.
 *
 * Nothing replaces it. Restlessness is carried by DELIBERATE motion instead:
 * URGENT walks a real 16 cm roam (WANDER_URGENT_RADIUS_CM) with a
 * movement-locked walk bob, sits taller and narrower via the posture scales
 * above, breathes faster, and turns to track the user. Per-frame jitter is
 * not a legitimate source of life here — at habitat distance it only ever
 * reads as a rendering fault.
 *
 * Kept as a named constant rather than deleted so the channel's absence is
 * explicit and the frequency is on record if anyone reconsiders it.
 */
export const POSTURE_URGENT_TREMOR_AMPLITUDE = 0.0;
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
/**
 * Peak yaw offset (deg) from habitatForwardYaw during CALM's slow gaze
 * sweep. This directly drives Body's world yaw (updateFaceAndSecondaryMotion
 * reads facingDir every frame), so the OLD value of 85 swept the entire
 * body through ~170 deg peak-to-peak once per ~20s cycle — a full-body
 * swivel, not a settled pet's occasional glance, and the single largest
 * remaining "sway" once wander/breathing were fixed. 18 keeps the head/body
 * turn readable as a lazy glance without reading as continuous rotation.
 */
export const GAZE_CALM_DRIFT_RANGE_DEG = 18;
export const GAZE_CALM_DRIFT_HZ = 0.05;
export const GAZE_URGENT_YAW_SPEED_DEG_S = 180;
/**
 * DISABLED (0) — the second half of the shake. This added +/-8 deg of yaw at
 * 3.2 Hz directly to Body's facing while URGENT, i.e. the whole creature
 * swinging through 16 deg more than three times a second. Together with the
 * 5.5 Hz posture tremor above, that is what made the cat look like it was
 * malfunctioning.
 *
 * URGENT attention is already carried by GAZE_URGENT_YAW_SPEED_DEG_S: the
 * creature snaps to face the user quickly and holds. A steady stare reads as
 * far more insistent than a vibrating one.
 */
export const GAZE_URGENT_TREMOR_DEG = 0;
export const GAZE_URGENT_TREMOR_HZ = 3.2;

// ── Per-creature identity color (appearanceSeed -> palette) ────────────────
/**
 * Body colors indexed by a task's appearanceSeed, so a given task always
 * renders as the same creature across restarts (the seed lives in TaskRecord
 * and is persisted; see CreatureBehavior.setAppearanceSeed).
 *
 * Tuned for an ADDITIVE display, where the panel adds light to the world and
 * black is fully transparent: a color's perceived strength is roughly its
 * brightness, and anything desaturated turns into washed-out grey haze over
 * the room behind it. So every entry stays high-saturation with at least one
 * channel near 1.0 and a clearly dominant hue — no pastels, no near-greys,
 * nothing that relies on a dark channel to read (dark = invisible here).
 * Hues are spaced around the wheel so adjacent creatures stay tellable apart
 * even when small and partly overlapping at habitat distance.
 */
export const CREATURE_PALETTE: [number, number, number, number][] = [
    [1.00, 0.55, 0.08, 1.0], // amber
    [0.10, 0.80, 0.98, 1.0], // cyan
    [1.00, 0.24, 0.62, 1.0], // magenta
    [0.42, 0.92, 0.26, 1.0], // green
    [0.64, 0.40, 1.00, 1.0], // violet
    [1.00, 0.86, 0.12, 1.0], // yellow
];

/**
 * Strength of the baked vertex-color shading multiplied onto the body color
 * (unlit.graphShader's `vertexShadingAmount` parameter; 0 = off, 1 = full).
 *
 * The gradient itself — darker feet/underside, lighter back and head — is
 * baked into the GLBs' COLOR_0 attribute by Tools/bake-vertex-shading.js, so
 * it costs nothing at runtime: no lighting, no extra draw calls, one extra
 * byte-per-channel vertex attribute.
 *
 * Read by PetBody.graphShader's `vertexShadingAmount` parameter (pet bodies
 * only — see the material note in CreatureBehavior). The shader blends from
 * white rather than multiplying raw, so 0 is an exact no-op.
 */
export const VERTEX_SHADING_AMOUNT = 1.0;

// ── Color tint (per-instance material baseColor shift, IDLE + CHASING) ─────
/**
 * Urgency no longer replaces the body color with a shared orange — that
 * erased every creature's identity exactly when several are on screen at
 * once. Instead each creature's OWN palette color is blended a fraction of
 * the way toward TINT_HEAT_COLOR, so it reads hotter while staying
 * recognizably itself. Deliberately modest: per the design intent, MOVEMENT
 * is the primary state signal and color is only a supporting cue.
 */
export const TINT_EASE_PER_S = 3.0;
export const TINT_HEAT_COLOR: [number, number, number, number] = [1.0, 0.26, 0.12, 1.0];
/**
 * Kept deliberately small. Verified in Preview: at 0.32/0.55 a CHASING yellow
 * creature rendered as the same orange as a CALM amber one — the heat shift
 * was large enough to collapse two palette entries into an identical color,
 * destroying exactly the per-task identity this palette exists to provide.
 * At these values a warm creature still reads as warmer, but never crosses
 * into a neighbouring palette hue. State legibility is carried by MOVEMENT
 * (see WANDER_URGENT_*) and posture, not by hue.
 */
export const TINT_URGENT_HEAT_BLEND = 0.15;
export const TINT_CHASE_HEAT_BLEND = 0.28;

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

// ── Scripted demo story beats (see Interaction/DemoSequence.ts) ────────────
/**
 * Beat lengths for the self-playing demo. Sum + RELEASE_DURATION_S is the
 * total story length; tuned so the whole loop lands just inside a 20s take
 * with each beat long enough to be read rather than merely detected.
 *
 * Budget (seconds), cumulative:
 *   0.0  CALM      three settled creatures, nothing moving
 *   3.5  URGENT    time advances; one grows, turns to face, walks restlessly
 *   9.0  APPROACH  it closes distance deliberately
 *  13.0  SELECT    full task text appears
 *  15.0  RESOLVE   press-and-hold, progress fills (RESOLVE_HOLD_DURATION_S)
 *  17.0  RELEASED  release effect plays (RELEASE_DURATION_S), two remain
 *  18.5  tail      the remaining two settle back
 */
/** Long enough to establish "nothing is happening" as the baseline the rest
 *  of the story departs from — the stillness only reads as stillness if it
 *  lasts. */
export const DEMO_BEAT_CALM_HOLD_S = 3.5;
/**
 * URGENT dwell BEFORE the approach starts. This is the beat that makes the
 * story legible: without it the arbiter names a chaser the instant urgency
 * crosses the threshold and the creature starts closing immediately, so
 * "became urgent" and "approached" collapse into a single unreadable motion.
 * 5.5s is enough for the growth ease (GROWTH_EASE_PER_S), the turn-to-face,
 * and at least one full restless walk leg to land as separate readable events.
 */
export const DEMO_BEAT_URGENT_DWELL_S = 5.5;
/** Time allowed for the approach itself, from look-pause to arrival. */
export const DEMO_BEAT_APPROACH_S = 4.0;
/** How long the full task text stays up before the resolve hold begins —
 *  long enough to actually read the line. */
export const DEMO_BEAT_SELECT_READ_S = 2.0;
/** Extra hold beyond RESOLVE_HOLD_DURATION_S before the gesture is released.
 *  Must be > 0: releasing exactly at completion risks the early-release
 *  cancel path winning the race and nothing resolving at all. */
export const DEMO_BEAT_RESOLVE_SETTLE_S = 0.5;

// ── Staging controls (pick a clean spot before recording) ─────────────────
/**
 * Whether the scripted story plays automatically on Lens start.
 *
 * Set false to stage: the three creatures spawn calm and STAY calm, so the
 * habitat can be walked around and repositioned without the story consuming a
 * creature underneath you. Press the replay key to run the story when framed.
 * (With autoplay on, a plain Preview refresh runs the whole loop, which means
 * the chaser approaches and is resolved away ~17s later whether or not you
 * were ready — see the staging key map in TaskOrganismController.)
 */
export const DEMO_AUTOPLAY_ON_START = true;
/** Per-keypress nudge for the runtime habitat placement controls. */
export const HABITAT_DEPTH_STEP_CM = 15;
export const HABITAT_LATERAL_STEP_CM = 15;
/**
 * Clamps for those controls. Depth stays far enough that a floor-level
 * creature is not directly under the user's chin and near enough to stay
 * inside the display FOV; lateral is bounded by the same measured
 * ~+/-70cm render-region edge that HABITAT_HOME_LATERAL_SPACING_CM respects,
 * minus room for the outer slot and its roam.
 */
export const HABITAT_DEPTH_MIN_CM = 120;
export const HABITAT_DEPTH_MAX_CM = 420;
export const HABITAT_LATERAL_LIMIT_CM = 60;
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
