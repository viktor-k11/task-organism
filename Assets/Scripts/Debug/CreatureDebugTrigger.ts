import { CreatureBehavior } from "../Creature/CreatureBehavior";
import { RELEASE_DURATION_S } from "../Config/CreatureConfig";

type AutoCyclePhase = "IDLE" | "CHASING" | "RELEASED";

/**
 * CreatureDebugTrigger — Inspector toggles for requestChase()/endChase()/
 * release()/reset()/recenterHabitat() plus an auto-cycling idle->chase->
 * release->reset demo loop. This is how Piece 1 is tested manually since
 * no task/arbiter exists yet (see CLAUDE.md "Out of scope this week"). Isolated on its own "Debug"
 * SceneObject so it's a one-line deletion once a real AttentionArbiter
 * exists to drive requestChase()/release() instead.
 *
 * Does NOT own any creature state — every toggle here is a thin call into
 * CreatureBehavior's public API.
 */
@component
export class CreatureDebugTrigger extends BaseScriptComponent {
    @ui.label('<span style="color: #60A5FA;">CreatureDebugTrigger – manual test harness</span>')
    @ui.separator
    @ui.label('<span style="color: #60A5FA;">References</span>')
    @ui.group_start("References")
    @input
    @hint("The CreatureBehavior component to drive.")
    creature!: CreatureBehavior;
    @ui.group_end

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Manual triggers (auto-reset after firing)</span>')
    @ui.group_start("Manual triggers")
    @input
    @hint("Toggle ON to fire requestChase() once.")
    triggerChase: boolean = false;

    @input
    @hint("Toggle ON to fire endChase() once (return to idle wander, no snap).")
    triggerEndChase: boolean = false;

    @input
    @hint("Toggle ON to fire release() once (idempotent — repeat toggles after the first are no-ops).")
    triggerRelease: boolean = false;

    @input
    @hint("Toggle ON to re-enable the Creature and start a fresh IDLE lifecycle, for repeat testing.")
    triggerReset: boolean = false;

    @input
    @hint("Toggle ON to re-anchor the habitat on the camera's CURRENT position/forward (preview/recording only — the habitat is otherwise world-anchored, not camera-following).")
    triggerRecenterHabitat: boolean = false;
    @ui.group_end

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Auto-cycle demo</span>')
    @ui.group_start("Auto-cycle demo")
    @input
    @hint("When ON, auto-cycles idle -> chase -> release -> reset -> idle indefinitely for hands-off demoing.")
    autoCycle: boolean = false;

    @input
    @widget(new SliderWidget(1, 10, 0.5))
    @hint("Seconds spent in each of the idle/chase auto-cycle phases before advancing.")
    autoCyclePhaseDurationS: number = 4.0;
    @ui.group_end

    private autoCycleTimer = 0;
    private autoCyclePhase: AutoCyclePhase = "IDLE";

    onAwake(): void {
        this.createEvent("OnStartEvent").bind(() => this.onStart());
        this.createEvent("UpdateEvent").bind(() => this.onUpdate());
    }

    private onStart(): void {
        if (!this.creature) {
            console.error("[CreatureDebugTrigger] creature not wired — check Phase B bootstrap wiring.");
        }
    }

    private onUpdate(): void {
        if (!this.creature) return;

        if (this.triggerChase) {
            this.creature.requestChase();
            this.triggerChase = false;
        }
        if (this.triggerEndChase) {
            this.creature.endChase();
            this.triggerEndChase = false;
        }
        if (this.triggerRelease) {
            this.creature.release();
            // Deliberately repeat the request in the same runtime tick. This
            // keeps the Preview-only harness honest: CreatureBehavior's
            // idempotency guard must suppress the second presentation event.
            this.creature.release();
            this.triggerRelease = false;
        }
        if (this.triggerReset) {
            this.creature.reset();
            this.triggerReset = false;
            this.autoCyclePhase = "IDLE";
            this.autoCycleTimer = 0;
        }
        if (this.triggerRecenterHabitat) {
            this.creature.recenterHabitat();
            this.triggerRecenterHabitat = false;
        }

        if (this.autoCycle) {
            this.updateAutoCycle();
        } else {
            this.autoCycleTimer = 0;
            this.autoCyclePhase = "IDLE";
        }
    }

    private updateAutoCycle(): void {
        this.autoCycleTimer += getDeltaTime();

        switch (this.autoCyclePhase) {
            case "IDLE":
                if (this.autoCycleTimer >= this.autoCyclePhaseDurationS) {
                    this.creature.requestChase();
                    this.autoCyclePhase = "CHASING";
                    this.autoCycleTimer = 0;
                }
                break;
            case "CHASING":
                if (this.autoCycleTimer >= this.autoCyclePhaseDurationS) {
                    this.creature.release();
                    this.autoCyclePhase = "RELEASED";
                    this.autoCycleTimer = 0;
                }
                break;
            case "RELEASED":
                // Wait for the release effect to finish, plus a short pause, then loop.
                if (this.autoCycleTimer >= RELEASE_DURATION_S + 1.0) {
                    this.creature.reset();
                    this.autoCyclePhase = "IDLE";
                    this.autoCycleTimer = 0;
                }
                break;
        }
    }
}
