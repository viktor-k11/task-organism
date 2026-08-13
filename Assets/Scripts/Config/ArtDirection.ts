/**
 * ArtDirection — the runtime values the VISUAL layer reads every frame.
 *
 * Why this exists
 * ---------------
 * CreatureConfig.ts holds 155 constants and is the single source of truth for
 * them (CLAUDE.md). That is right for engineers and useless for a designer:
 * `export const` cannot be edited from the Lens Studio Inspector, and anything
 * a designer changed on a scene object was previously overwritten the next time
 * the runtime initialised.
 *
 * So the split is by AUDIENCE, not by file:
 *
 *   - CreatureConfig stays the DEFAULTS. Nothing here invents a number; every
 *     field below is seeded from the corresponding constant, so deleting the
 *     Art Direction object from the scene changes nothing at all.
 *   - CreatureArtDirection (a @component) publishes Inspector-editable copies
 *     of the designer-facing subset and calls applyArtDirection() in onAwake.
 *   - The visual components READ `ART.x` instead of importing the constant, so
 *     an Inspector edit survives initialisation instead of being clobbered.
 *
 * What is deliberately NOT here
 * -----------------------------
 * Domain thresholds — CHASE_THRESHOLD, URGENCY_AGE_WINDOW_MS,
 * LATER_SNOOZE_DURATION_MS, RESOLVE_HOLD_DURATION_S. Those are behaviour
 * contracts covered by the LEAF suite and by the CLAUDE.md invariants, not art.
 * Moving them into the Inspector would let a colour change quietly alter when a
 * creature starts chasing, which is exactly the class of accident this file is
 * meant to prevent. They stay in code, unreachable from the editor.
 *
 * Ordering
 * --------
 * applyArtDirection() runs in the component's onAwake. Lens Studio fires every
 * OnAwakeEvent before any OnStartEvent, and every reader below consumes these
 * values in onStart or later (per-frame), so the values are always populated
 * before first use regardless of where the object sits in the hierarchy.
 */
import {
    CREATURE_PALETTE,
    HABITAT_HOME_DEPTH_CM,
    HABITAT_HOME_LATERAL_SPACING_CM,
    HABITAT_CAPACITY_SPACING_CM,
    HABITAT_ROW_DEPTH_STEP_CM,
    GROUND_Y_OFFSET_CM,
    HABITAT_VISUAL_SCALE,
    CHASE_VISUAL_SCALE,
    BREATHE_CALM_AMPLITUDE,
    BREATHE_URGENT_AMPLITUDE,
    BREATHE_CHASE_AMPLITUDE,
    POSTURE_CALM_HEIGHT_SCALE,
    POSTURE_CALM_WIDTH_SCALE,
    POSTURE_URGENT_HEIGHT_SCALE,
    POSTURE_URGENT_WIDTH_SCALE,
    POSTURE_CHASE_HEIGHT_SCALE,
    POSTURE_CHASE_WIDTH_SCALE,
    CHASE_DISTANCE_MIN_CM,
    CHASE_DISTANCE_MAX_CM,
    CHASE_STOP_DISTANCE_CM,
    RELEASE_DURATION_S,
    RELEASE_PARTICLE_COUNT,
    RELEASE_PARTICLE_SPEED_CM_S,
    RELEASE_PARTICLE_DRIFT_CM,
    RELEASE_PARTICLE_SIZE_CM,
    RELEASE_BRIGHTEN_LERP,
    HABITAT_LABEL_MAX_CHARS,
    SELECTION_LINE_MAX_CHARS,
    TASK_SELECTION_PANEL_Y_CM,
} from "./CreatureConfig";

export interface ArtDirectionValues {
    // Palette — one RGBA per creature identity, selected by appearanceSeed.
    palette: [number, number, number, number][];

    // Habitat placement
    habitatDepthCm: number;
    habitatSpacingCm: number;
    habitatCapacitySpacingCm: number;
    habitatRowDepthStepCm: number;
    /** THE shared floor reference. Floor disc and every creature's foot line
     *  both derive from this one number — see the CLAUDE.md grounding rule. */
    groundYOffsetCm: number;

    // Presentation scale
    habitatVisualScale: number;
    chaseVisualScale: number;

    // Breathing
    breatheCalmAmplitude: number;
    breatheUrgentAmplitude: number;
    breatheChaseAmplitude: number;

    // Posture (height/width pairs — a squash keeps volume by widening)
    postureCalmHeight: number;
    postureCalmWidth: number;
    postureUrgentHeight: number;
    postureUrgentWidth: number;
    postureChaseHeight: number;
    postureChaseWidth: number;

    // Chase distances
    chaseDistanceMinCm: number;
    chaseDistanceMaxCm: number;
    chaseStopDistanceCm: number;

    // Release effect
    releaseDurationS: number;
    releaseParticleCount: number;
    releaseParticleSpeedCmS: number;
    releaseParticleDriftCm: number;
    releaseParticleSizeCm: number;
    releaseBrightenLerp: number;

    // Labels
    habitatLabelMaxChars: number;
    selectionLineMaxChars: number;
    selectionPanelYCm: number;
}

/** Live values. Seeded from CreatureConfig, so this module is a no-op until a
 *  CreatureArtDirection component overrides something. */
export const ART: ArtDirectionValues = {
    palette: CREATURE_PALETTE.map((c) => [c[0], c[1], c[2], c[3]]) as [number, number, number, number][],

    habitatDepthCm: HABITAT_HOME_DEPTH_CM,
    habitatSpacingCm: HABITAT_HOME_LATERAL_SPACING_CM,
    habitatCapacitySpacingCm: HABITAT_CAPACITY_SPACING_CM,
    habitatRowDepthStepCm: HABITAT_ROW_DEPTH_STEP_CM,
    groundYOffsetCm: GROUND_Y_OFFSET_CM,

    habitatVisualScale: HABITAT_VISUAL_SCALE,
    chaseVisualScale: CHASE_VISUAL_SCALE,

    breatheCalmAmplitude: BREATHE_CALM_AMPLITUDE,
    breatheUrgentAmplitude: BREATHE_URGENT_AMPLITUDE,
    breatheChaseAmplitude: BREATHE_CHASE_AMPLITUDE,

    postureCalmHeight: POSTURE_CALM_HEIGHT_SCALE,
    postureCalmWidth: POSTURE_CALM_WIDTH_SCALE,
    postureUrgentHeight: POSTURE_URGENT_HEIGHT_SCALE,
    postureUrgentWidth: POSTURE_URGENT_WIDTH_SCALE,
    postureChaseHeight: POSTURE_CHASE_HEIGHT_SCALE,
    postureChaseWidth: POSTURE_CHASE_WIDTH_SCALE,

    chaseDistanceMinCm: CHASE_DISTANCE_MIN_CM,
    chaseDistanceMaxCm: CHASE_DISTANCE_MAX_CM,
    chaseStopDistanceCm: CHASE_STOP_DISTANCE_CM,

    releaseDurationS: RELEASE_DURATION_S,
    releaseParticleCount: RELEASE_PARTICLE_COUNT,
    releaseParticleSpeedCmS: RELEASE_PARTICLE_SPEED_CM_S,
    releaseParticleDriftCm: RELEASE_PARTICLE_DRIFT_CM,
    releaseParticleSizeCm: RELEASE_PARTICLE_SIZE_CM,
    releaseBrightenLerp: RELEASE_BRIGHTEN_LERP,

    habitatLabelMaxChars: HABITAT_LABEL_MAX_CHARS,
    selectionLineMaxChars: SELECTION_LINE_MAX_CHARS,
    selectionPanelYCm: TASK_SELECTION_PANEL_Y_CM,
};

/** Overwrites only the keys provided. Called once, from
 *  CreatureArtDirection.onAwake. */
export function applyArtDirection(overrides: Partial<ArtDirectionValues>): void {
    for (const key of Object.keys(overrides) as (keyof ArtDirectionValues)[]) {
        const v = overrides[key];
        if (v !== undefined && v !== null) (ART as unknown as Record<string, unknown>)[key] = v as unknown;
    }
}
