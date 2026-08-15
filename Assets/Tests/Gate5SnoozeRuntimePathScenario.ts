import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { DemoClock } from "../Scripts/Data/Clock";
import { TaskRepository } from "../Scripts/Data/TaskRepository";
import { StateEngine } from "../Scripts/State/StateEngine";
import { AttentionArbiter } from "../Scripts/State/AttentionArbiter";
import { TaskResolutionService } from "../Scripts/State/TaskResolutionService";
import { CreatureInteractionState } from "../Scripts/Interaction/CreatureInteractionState";
import { LATER_SNOOZE_DURATION_MS, URGENCY_AGE_WINDOW_MS } from "../Scripts/Config/CreatureConfig";
import { CountingTaskStorage, gateTask } from "./Gate2Support";

/**
 * Gate 5 — the RUNTIME snooze path, not the repository mutation.
 *
 * `gate3-later-snooze` already covers `repository.snooze(...)`. It passed for
 * the whole life of the project while the path a user actually takes had never
 * executed once: the Later button calls
 * `CreatureInteractionState.later()`, which owns selection state and hooks as
 * well as the repository write, and none of that was under test.
 *
 * This scenario drives `later()` — the same method the button's callback
 * invokes — and asserts the things the controller's callback depends on:
 *   - it only succeeds when something is actually selected
 *   - selection is cleared afterwards (the panel must close)
 *   - both hooks fire, since the controller's status update and progress reset
 *     hang off them
 *   - the snoozed task stops being arbiter-eligible
 *   - it becomes eligible again once the snooze expires
 *
 * What this scenario still cannot cover: the SIK button press itself and the
 * audible settle cue. Those were exercised by hand for the first time on
 * 2026-08-14 via PreviewInteractTool against a frozen selection frame, and the
 * result — including a defect — is recorded in prompts.md.
 */
@component
export class Gate5SnoozeRuntimePathScenario extends Scenario {
    async run(): Promise<void> {
        const storage = new CountingTaskStorage();
        storage.tasks = [gateTask("snoozed", "Defer me", 0), gateTask("other", "Other task", 0)];
        const clock = new DemoClock(0);
        const repository = new TaskRepository(storage, clock);
        repository.restore();
        const engine = new StateEngine(clock);
        const arbiter = new AttentionArbiter(engine);
        const resolution = new TaskResolutionService(repository, () => { /* release not under test here */ });

        let selectionChanges = 0;
        let lastSelection: string | null = "sentinel";
        let progressResets = 0;
        const interaction = new CreatureInteractionState(repository, resolution, {
            onSelectionChanged: (id) => { selectionChanges++; lastSelection = id; },
            onResolveProgress: (p) => { if (p === 0) progressResets++; },
        });

        // Age both tasks past the threshold so the arbiter has a real choice.
        clock.setNowMs(URGENCY_AGE_WINDOW_MS * 2);

        // later() with nothing selected must be a no-op — the controller's
        // callback guards on selectedId, but the method must not depend on it.
        expect(interaction.later()).toBe(false);

        // Select through the real gesture entry points, as the button path does.
        interaction.pressStart("snoozed");
        interaction.pressEnd();
        expect(interaction.selectedId).toBe("snoozed");

        const beforeSnooze = arbiter.selectChaser(repository.listOpen());
        expect(beforeSnooze !== null).toBe(true);

        // The call the Later button makes.
        expect(interaction.later()).toBe(true);

        // The panel must close and progress must reset — the controller relies
        // on both hooks to update its status line and clear the hold ring.
        expect(interaction.selectedId).toBe(null);
        expect(lastSelection).toBe(null);
        expect(selectionChanges > 0).toBe(true);
        expect(progressResets > 0).toBe(true);

        // Snoozed means not eligible to chase — invariant 3's threshold check
        // includes `now >= snoozedUntilMs`.
        const duringSnooze = arbiter.selectChaser(repository.listOpen());
        expect(duringSnooze !== null).toBe(true);
        expect(duringSnooze!.id).toBe("other");

        // ...and still open. Snoozing is not completing.
        expect(repository.listOpen().length).toBe(2);

        // After expiry it competes again. It is the older/more urgent of the
        // two, so it should win the arbiter back.
        clock.setNowMs(clock.nowMs() + LATER_SNOOZE_DURATION_MS + 1000);
        const afterExpiry = arbiter.selectChaser(repository.listOpen());
        expect(afterExpiry !== null).toBe(true);
        expect(afterExpiry!.id).toBe("snoozed");

        console.log("[Gate5] later() cleared selection, fired both hooks, removed the task from arbiter eligibility, and restored it after expiry");
    }
}
