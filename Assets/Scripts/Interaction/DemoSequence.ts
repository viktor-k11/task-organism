import {
    DEMO_BEAT_CALM_HOLD_S,
    DEMO_BEAT_URGENT_DWELL_S,
    DEMO_BEAT_APPROACH_S,
    DEMO_BEAT_SELECT_READ_S,
    DEMO_BEAT_RESOLVE_SETTLE_S,
    RESOLVE_HOLD_DURATION_S,
} from "../Config/CreatureConfig";

/**
 * Named beats of the scripted demo story, in order. Exposed so the controller
 * and any test can refer to a beat by name instead of a magic index.
 */
export type DemoBeat =
    | "CALM"        // three settled creatures, nothing happening
    | "URGENT"      // time advanced; one creature grows, faces the user, walks restlessly
    | "APPROACH"    // that creature closes distance deliberately
    | "SELECT"      // short pinch: full task text revealed
    | "RESOLVE"     // press-and-hold: progress fills
    | "RELEASED";   // creature let go; the remaining two settle

export interface DemoSequenceHooks {
    /** Advance the demo clock so the oldest task crosses CHASE_THRESHOLD. */
    onAdvanceTime(): void;
    /** Begin the deliberate approach for the current chaser. */
    onBeginApproach(): void;
    /** Short pinch on the chaser — reveals full text. */
    onSelect(): void;
    /** Press-and-hold begins; progress feedback runs from here. */
    onResolveHoldStart(): void;
    /** Gesture released after the hold completed. */
    onResolveHoldEnd(): void;
    /** Beat changed — for status copy and evidence logging. */
    onBeat(beat: DemoBeat, elapsedS: number): void;
}

interface Step {
    atS: number;
    beat: DemoBeat;
    run(hooks: DemoSequenceHooks): void;
}

/**
 * Drives the six-beat demo story on a fixed timeline so the whole loop —
 * calm -> urgent -> approach -> select -> resolve -> release -> two remain —
 * reads as one continuous ~20s take rather than a set of features that have
 * to be triggered by hand.
 *
 * Deliberately a pure timeline with no Lens API surface: it only advances an
 * elapsed counter and fires callbacks, so the pacing can be reasoned about
 * (and tested) without a running preview. All beat lengths live in
 * CreatureConfig with the rest of the tunables.
 *
 * It scripts only things a USER could do (advance time via the demo control,
 * pinch, hold, release). It never writes creature or repository state
 * directly, so the sequence cannot drift from the behavior the real
 * interaction path produces.
 */
export class DemoSequence {
    private elapsedS = 0;
    private nextStepIndex = 0;
    private started = false;
    private currentBeat: DemoBeat = "CALM";
    private readonly steps: Step[];

    constructor(private hooks: DemoSequenceHooks) {
        // Absolute times, accumulated from the beat durations so that editing
        // one beat length shifts everything after it instead of silently
        // overlapping the next beat.
        const tUrgent = DEMO_BEAT_CALM_HOLD_S;
        const tApproach = tUrgent + DEMO_BEAT_URGENT_DWELL_S;
        const tSelect = tApproach + DEMO_BEAT_APPROACH_S;
        const tResolve = tSelect + DEMO_BEAT_SELECT_READ_S;
        const tHoldEnd = tResolve + RESOLVE_HOLD_DURATION_S + DEMO_BEAT_RESOLVE_SETTLE_S;

        this.steps = [
            { atS: tUrgent, beat: "URGENT", run: (h) => h.onAdvanceTime() },
            { atS: tApproach, beat: "APPROACH", run: (h) => h.onBeginApproach() },
            { atS: tSelect, beat: "SELECT", run: (h) => h.onSelect() },
            { atS: tResolve, beat: "RESOLVE", run: (h) => h.onResolveHoldStart() },
            // The hold must outlast RESOLVE_HOLD_DURATION_S or the gesture
            // cancels as an early release and nothing resolves — the settle
            // margin above is what guarantees completion before this fires.
            { atS: tHoldEnd, beat: "RELEASED", run: (h) => h.onResolveHoldEnd() },
        ];
    }

    /** Total scripted length excluding the trailing "two remain" tail. */
    get scriptedEndS(): number {
        return this.steps.length ? this.steps[this.steps.length - 1].atS : 0;
    }

    get beat(): DemoBeat {
        return this.currentBeat;
    }

    get isFinished(): boolean {
        return this.nextStepIndex >= this.steps.length;
    }

    start(): void {
        if (this.started) return;
        this.started = true;
        this.elapsedS = 0;
        this.nextStepIndex = 0;
        this.currentBeat = "CALM";
        this.hooks.onBeat("CALM", 0);
    }

    update(deltaS: number): void {
        if (!this.started || this.isFinished) return;
        this.elapsedS += Math.max(0, deltaS);
        // A long frame hitch can cross more than one beat; fire every step it
        // passed, in order, rather than dropping the ones it skipped over.
        while (this.nextStepIndex < this.steps.length && this.elapsedS >= this.steps[this.nextStepIndex].atS) {
            const step = this.steps[this.nextStepIndex];
            this.nextStepIndex++;
            this.currentBeat = step.beat;
            step.run(this.hooks);
            this.hooks.onBeat(step.beat, this.elapsedS);
        }
    }
}
