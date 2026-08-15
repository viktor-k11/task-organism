import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { armAt, habitatTarget, logOutcome, pinchCreature } from "./Gate6Support";

const ID = "gate6-pinch-select";

/**
 * Gate 6.1 — a real short pinch on a habitat creature selects it.
 *
 * `gate3-short-pinch-select` calls pressStart/pressEnd on the state machine.
 * This one requires the pinch to find the creature's collider in space and
 * reach its Interactable, so it fails if the collider is missing, wrongly
 * sized, or if a label plate is sitting in front of it.
 */
@component
export class Gate6PinchSelectScenario extends Scenario {
    async run(): Promise<void> {
        // CALM: everyone still in the habitat, nothing selected. Paused so the
        // story cannot advance out from under the gesture.
        const controller = armAt(ID, "CALM", { pause: true });
        const target = habitatTarget(ID, controller);
        const before = controller.gestureHarnessSnapshot();

        await pinchCreature(ID, target, 150);

        const after = controller.gestureHarnessSnapshot();
        logOutcome(ID, before, after);

        // Selected the creature the pinch landed on — and specifically that
        // one. Selecting a DIFFERENT creature is the target-resolution defect
        // this scenario exists to catch.
        expect(after.selectedId).toBe(target.taskId);

        // A short pinch is a read, not a write.
        expect(after.openCount).toBe(before.openCount);
        expect(after.releaseCount).toBe(before.releaseCount);

        console.log(`[${ID}] PASS — real pinch selected ${after.selectedId}, no write, no release`);
    }
}
