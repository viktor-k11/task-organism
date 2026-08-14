import { ART, applyArtDirection } from "../Config/ArtDirection";

/**
 * CreatureArtDirection — the designer's control panel.
 *
 * Put this on ONE scene object (the authored "Art Direction" object). Every
 * field below appears in the Inspector, and the runtime READS them instead of
 * overwriting them: applyArtDirection() copies these into the shared ART
 * registry during onAwake, before any creature has built its visual.
 *
 * Defaults are seeded from CreatureConfig.ts, so an untouched component
 * reproduces the current look exactly. Change a number here, hit Preview, see
 * the difference — no source editing, no recompile of behaviour code.
 *
 * NOT in this panel, on purpose: CHASE_THRESHOLD, the urgency window, the
 * snooze duration and the resolve hold time. Those are behaviour contracts
 * verified by the LEAF suite, not art direction. See HANDOFF-VISUAL.md.
 */
@component
export class CreatureArtDirection extends BaseScriptComponent {
    // ── Palette ───────────────────────────────────────────────────────────
    @ui.label('<span style="color: #F59E0B;">Art Direction — safe to edit</span>')
    @ui.label('<span style="color: #9CA3AF;">Defaults match CreatureConfig.ts. See HANDOFF-VISUAL.md.</span>')
    @ui.separator
    @ui.group_start("Palette (one colour per creature identity)")
    @input
    @hint("Creature identity colours, picked by appearanceSeed. SPECS composites additively: near-black reads as invisible, pale/desaturated reads as washed out. Keep these saturated and bright.")
    @widget(new ColorWidget())
    paletteColors: vec4[] = [];
    @ui.group_end

    // ── Habitat placement ─────────────────────────────────────────────────
    @ui.separator
    @ui.group_start("Habitat placement")
    @input
    @hint("Distance in front of the user where the creatures live, in cm. CLAUDE.md comfort range is 100-150 for the habitat; the demo sits further back so six fit.")
    @widget(new SliderWidget(120, 420, 5))
    habitatDepthCm: number = ART.habitatDepthCm;
    @input
    @hint("Side-to-side gap between creatures in cm, when 4 or fewer are alive.")
    @widget(new SliderWidget(18, 60, 1))
    habitatSpacingCm: number = ART.habitatSpacingCm;
    @input
    @hint("Side-to-side gap in cm once 5-6 creatures are alive and the habitat splits into two rows. Tighter than the single-row spacing so the outer creatures stay inside the display's FOV.")
    @widget(new SliderWidget(18, 45, 1))
    habitatCapacitySpacingCm: number = ART.habitatCapacitySpacingCm;
    @input
    @hint("How much further back the second row sits, in cm.")
    @widget(new SliderWidget(20, 80, 5))
    habitatRowDepthStepCm: number = ART.habitatRowDepthStepCm;
    @input
    @hint("THE shared ground line, in cm relative to the camera. Negative = below eye level. The floor disc and every creature's feet both derive from this ONE number — changing it moves them together. Derived from 150cm standing eye height; do not split it into per-creature offsets.")
    @widget(new SliderWidget(-200, -80, 1))
    groundYOffsetCm: number = ART.groundYOffsetCm;
    @ui.group_end

    // ── Presentation scale ────────────────────────────────────────────────
    @ui.separator
    @ui.group_start("Presentation scale")
    @input
    @hint("Overall creature size while resting in the habitat (multiplier). 0.68 renders roughly a 23cm creature from the 34cm model.")
    @widget(new SliderWidget(0.3, 1.5, 0.01))
    habitatVisualScale: number = ART.habitatVisualScale;
    @input
    @hint("Overall creature size while chasing. Larger than the habitat scale so the approaching creature gains presence.")
    @widget(new SliderWidget(0.3, 1.5, 0.01))
    chaseVisualScale: number = ART.chaseVisualScale;
    @ui.group_end

    // ── Breathing ─────────────────────────────────────────────────────────
    @ui.separator
    @ui.group_start("Breathing amplitude")
    @input
    @hint("How much a calm creature swells as it breathes. Kept small: at 0.06 the breathing compounded with lean and squash into a visible sway.")
    @widget(new SliderWidget(0, 0.08, 0.001))
    breatheCalmAmplitude: number = ART.breatheCalmAmplitude;
    @input
    @hint("Breathing depth while restless.")
    @widget(new SliderWidget(0, 0.08, 0.001))
    breatheUrgentAmplitude: number = ART.breatheUrgentAmplitude;
    @input
    @hint("Breathing depth while chasing.")
    @widget(new SliderWidget(0, 0.08, 0.001))
    breatheChaseAmplitude: number = ART.breatheChaseAmplitude;
    @ui.group_end

    // ── Posture ───────────────────────────────────────────────────────────
    @ui.separator
    @ui.group_start("Posture (height / width per state)")
    @ui.label('<span style="color: #9CA3AF;">Height under 1.0 squashes; widen to keep volume. These were tuned against a tall blob and flatten round species (penguin, rabbit) more than tall ones.</span>')
    @input
    @widget(new SliderWidget(0.6, 1.4, 0.01))
    postureCalmHeight: number = ART.postureCalmHeight;
    @input
    @widget(new SliderWidget(0.6, 1.4, 0.01))
    postureCalmWidth: number = ART.postureCalmWidth;
    @input
    @widget(new SliderWidget(0.6, 1.4, 0.01))
    postureUrgentHeight: number = ART.postureUrgentHeight;
    @input
    @widget(new SliderWidget(0.6, 1.4, 0.01))
    postureUrgentWidth: number = ART.postureUrgentWidth;
    @input
    @widget(new SliderWidget(0.6, 1.4, 0.01))
    postureChaseHeight: number = ART.postureChaseHeight;
    @input
    @widget(new SliderWidget(0.6, 1.4, 0.01))
    postureChaseWidth: number = ART.postureChaseWidth;
    @ui.group_end

    // ── Chase distances ───────────────────────────────────────────────────
    @ui.separator
    @ui.group_start("Chase distances (spatial comfort)")
    @ui.label('<span style="color: #9CA3AF;">CLAUDE.md comfort rule: target 110-130cm, hard stop at 100cm. Coming closer than 100cm is uncomfortable in a headset — do not lower the stop distance.</span>')
    @input
    @widget(new SliderWidget(100, 160, 1))
    chaseDistanceMinCm: number = ART.chaseDistanceMinCm;
    @input
    @widget(new SliderWidget(100, 180, 1))
    chaseDistanceMaxCm: number = ART.chaseDistanceMaxCm;
    @input
    @hint("Hard floor on how close a creature ever gets. Comfort limit, not a look — raising it is safe, lowering it is not.")
    @widget(new SliderWidget(90, 140, 1))
    chaseStopDistanceCm: number = ART.chaseStopDistanceCm;
    @ui.group_end

    // ── Urgency halo ──────────────────────────────────────────────────────
    @ui.separator
    @ui.group_start("Urgency halo (light, not paint)")
    @ui.label('<span style="color: #9CA3AF;">Urgency is carried by an additive halo in the creature\'s own colour, so palette identity survives. These two numbers decide how much of the signal this channel carries. The halo reads strongly on dark backdrops and weakly on bright ones — a small warm colour shift remains as the bright-backdrop fallback.</span>')
    @input
    @hint("How brightly the halo burns at full urgency. 0 disables the rim entirely and leaves only the warm colour shift.")
    @widget(new SliderWidget(0, 4, 0.05))
    urgencyRimGain: number = ART.urgencyRimGain;
    @input
    @hint("How tightly the halo hugs the silhouette. Low (0.5-1.5) washes the whole body; high (4+) is a thin bright edge. Below 0.25 the shader clamps, because a 0 exponent would flood the entire body.")
    @widget(new SliderWidget(0.5, 6, 0.1))
    urgencyRimPower: number = ART.urgencyRimPower;
    @ui.group_end

    // ── Release effect ────────────────────────────────────────────────────
    @ui.separator
    @ui.group_start("Release effect (completion moment)")
    @ui.label('<span style="color: #9CA3AF;">Tone: release and gratitude, never reward or disappearance. See the CLAUDE.md tone rules.</span>')
    @input
    @widget(new SliderWidget(0.5, 3.0, 0.1))
    releaseDurationS: number = ART.releaseDurationS;
    @input
    @hint("Particles spawned in one burst. Each is a draw call's worth of work — raising this is the main cost knob in the release moment.")
    @widget(new SliderWidget(0, 60, 1))
    releaseParticleCount: number = ART.releaseParticleCount;
    @input
    @widget(new SliderWidget(0, 30, 0.5))
    releaseParticleSpeedCmS: number = ART.releaseParticleSpeedCmS;
    @input
    @widget(new SliderWidget(0, 20, 0.5))
    releaseParticleDriftCm: number = ART.releaseParticleDriftCm;
    @input
    @widget(new SliderWidget(0.1, 3.0, 0.1))
    releaseParticleSizeCm: number = ART.releaseParticleSizeCm;
    @input
    @hint("How far the body brightens toward white at the moment of release.")
    @widget(new SliderWidget(0, 1, 0.05))
    releaseBrightenLerp: number = ART.releaseBrightenLerp;
    @ui.group_end

    // ── Labels ────────────────────────────────────────────────────────────
    @ui.separator
    @ui.group_start("Labels")
    @input
    @hint("Characters before the short habitat label truncates.")
    @widget(new SliderWidget(8, 40, 1))
    habitatLabelMaxChars: number = ART.habitatLabelMaxChars;
    @input
    @hint("Characters per line in the full task panel. CLAUDE.md caps the panel at two lines.")
    @widget(new SliderWidget(15, 60, 1))
    selectionLineMaxChars: number = ART.selectionLineMaxChars;
    @input
    @hint("Height of the selection panel above the creature, in cm.")
    @widget(new SliderWidget(10, 60, 1))
    selectionPanelYCm: number = ART.selectionPanelYCm;
    @ui.group_end

    onAwake(): void {
        // Palette is only overridden when the designer actually populated the
        // list. An empty Inspector array means "use the CreatureConfig
        // defaults" rather than "make every creature black", which is what a
        // blind copy would do the first time someone adds this component.
        const palette = this.paletteColors && this.paletteColors.length > 0
            ? this.paletteColors.map((c) => [c.r, c.g, c.b, c.a] as [number, number, number, number])
            : undefined;

        // A component that has just been added to a scene object has no stored
        // Inspector values yet, and Lens Studio hands those fields to us as 0 —
        // the TypeScript initializers above are only editor-side defaults, not
        // runtime ones. Applying that blindly wrote 0 over every distance and
        // scale the first time this component was added, collapsing the whole
        // habitat to a single point. So for the fields where zero is not a
        // meaningful art choice, zero means "unset" and the CreatureConfig
        // default survives.
        //
        // Amplitudes are deliberately NOT in this list: 0 breathing and 0
        // particles are legitimate things for a designer to ask for, so those
        // pass through exactly as entered.
        const positive = (v: number, fallback: number) => (v > 0 ? v : fallback);
        // Ground offset is the one meaningful NEGATIVE value, so it gets its
        // own test: 0 would put the floor at eye height, which is never wanted.
        const negative = (v: number, fallback: number) => (v < 0 ? v : fallback);

        applyArtDirection({
            palette,
            habitatDepthCm: positive(this.habitatDepthCm, ART.habitatDepthCm),
            habitatSpacingCm: positive(this.habitatSpacingCm, ART.habitatSpacingCm),
            habitatCapacitySpacingCm: positive(this.habitatCapacitySpacingCm, ART.habitatCapacitySpacingCm),
            habitatRowDepthStepCm: positive(this.habitatRowDepthStepCm, ART.habitatRowDepthStepCm),
            groundYOffsetCm: negative(this.groundYOffsetCm, ART.groundYOffsetCm),
            habitatVisualScale: positive(this.habitatVisualScale, ART.habitatVisualScale),
            chaseVisualScale: positive(this.chaseVisualScale, ART.chaseVisualScale),
            breatheCalmAmplitude: this.breatheCalmAmplitude,
            breatheUrgentAmplitude: this.breatheUrgentAmplitude,
            breatheChaseAmplitude: this.breatheChaseAmplitude,
            postureCalmHeight: positive(this.postureCalmHeight, ART.postureCalmHeight),
            postureCalmWidth: positive(this.postureCalmWidth, ART.postureCalmWidth),
            postureUrgentHeight: positive(this.postureUrgentHeight, ART.postureUrgentHeight),
            postureUrgentWidth: positive(this.postureUrgentWidth, ART.postureUrgentWidth),
            postureChaseHeight: positive(this.postureChaseHeight, ART.postureChaseHeight),
            postureChaseWidth: positive(this.postureChaseWidth, ART.postureChaseWidth),
            chaseDistanceMinCm: positive(this.chaseDistanceMinCm, ART.chaseDistanceMinCm),
            chaseDistanceMaxCm: positive(this.chaseDistanceMaxCm, ART.chaseDistanceMaxCm),
            chaseStopDistanceCm: positive(this.chaseStopDistanceCm, ART.chaseStopDistanceCm),
            // Gain passes through unguarded: 0 is a legitimate "halo off".
            // Power does NOT — 0 would flood the body, so it falls back.
            urgencyRimGain: this.urgencyRimGain,
            urgencyRimPower: positive(this.urgencyRimPower, ART.urgencyRimPower),
            releaseDurationS: positive(this.releaseDurationS, ART.releaseDurationS),
            releaseParticleCount: this.releaseParticleCount,
            releaseParticleSpeedCmS: this.releaseParticleSpeedCmS,
            releaseParticleDriftCm: this.releaseParticleDriftCm,
            releaseParticleSizeCm: positive(this.releaseParticleSizeCm, ART.releaseParticleSizeCm),
            releaseBrightenLerp: this.releaseBrightenLerp,
            habitatLabelMaxChars: positive(this.habitatLabelMaxChars, ART.habitatLabelMaxChars),
            selectionLineMaxChars: positive(this.selectionLineMaxChars, ART.selectionLineMaxChars),
            selectionPanelYCm: positive(this.selectionPanelYCm, ART.selectionPanelYCm),
        });
        console.log(
            `[ArtDirection] applied — habitat ${ART.habitatDepthCm}cm, spacing ${ART.habitatSpacingCm}/${ART.habitatCapacitySpacingCm}cm, ground ${ART.groundYOffsetCm}cm, palette ${ART.palette.length} colours`,
        );
    }
}
