import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { RESOLVE_HOLD_DURATION_S } from "../Scripts/Config/CreatureConfig";
import { armAt, habitatTarget, logOutcome, pinchCreature } from "./Gate6Support";

const ID = "gate6-pinch-hold-resolve";

/**
 * Gate 6.2 — a real pinch-and-hold to completion resolves the task.
 *
 * TWO PINCHES, NOT ONE, AND THAT IS THE CONTRACT
 * ----------------------------------------------
 * CreatureInteractionState freezes the gesture's role at press time: a press
 * on an UNSELECTED creature is a "select" and stays one however long it is
 * held. So holding a fresh creature does not complete it — you select, then
 * hold. This scenario drives both pinches for real, which is also the first
 * automated coverage of that role-freezing rule through the input path.
 *
 * This is the product's only destructive gesture. It must produce exactly one
 * completion and exactly one release effect — not two, which is what a
 * double-fire in the Interactable wiring would give (`onTriggerEnd` and
 * `onTriggerEndOutside` are both wired to pressEnd).
 */
@component
export class Gate6PinchHoldResolveScenario extends Scenario {
    async run(): Promise<void> {
        const controller = armAt(ID, "CALM", { pause: true });
        const target = habitatTarget(ID, controller);
        const before = controller.gestureHarnessSnapshot();

        // First pinch: select. Role is frozen here as "select".
        await pinchCreature(ID, target, 150);
        const selected = controller.gestureHarnessSnapshot();
        expect(selected.selectedId).toBe(target.taskId);
        expect(selected.openCount).toBe(before.openCount);

        // Second pinch on the already-selected creature: role is "resolve".
        // Held well past RESOLVE_HOLD_DURATION_S because preview frame times
        // here are long and irregular — the threshold must be crossed by the
        // hold, not by luck.
        await pinchCreature(ID, target, Math.round(RESOLVE_HOLD_DURATION_S * 1000) + 1200);

        const after = controller.gestureHarnessSnapshot();
        logOutcome(ID, before, after);

        // Exactly one release effect for exactly one completed task.
        expect(after.releaseCount).toBe(before.releaseCount + 1);
        expect(after.openCount).toBe(before.openCount - 1);

        // Completion clears the selection — the panel must not outlive the
        // creature it described.
        expect(after.selectedId).toBe(null);

        console.log(
            `[${ID}] PASS — real hold resolved ${target.taskId}: one release, open ${before.openCount}->${after.openCount}`
        );
    }
}
