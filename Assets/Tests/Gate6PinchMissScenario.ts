import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { armAt, habitatTarget, logOutcome, pinchCreature, pinchEmptySpace } from "./Gate6Support";

const ID = "gate6-pinch-miss";

/**
 * Gate 6.4 — a pinch that misses every creature deselects, and does no harm.
 *
 * Playbook v3 §3.2 specifies "tapping elsewhere deselects". It went unbuilt
 * until this scenario reported it missing, which also made it a product hole:
 * with the panel open, the only exits were Later and completing the task, so a
 * user who simply changed their mind was stuck.
 *
 * Both halves are asserted here:
 *   - the panel closes
 *   - and nothing is written; in particular the miss must not land on some
 *     OTHER creature, which is a real test of collider size. If a collider is
 *     far larger than its creature — the 20x20x20-default defect in its other
 *     direction — a pinch aimed at nothing still hits something.
 */
@component
export class Gate6PinchMissScenario extends Scenario {
    async run(): Promise<void> {
        const controller = armAt(ID, "CALM", { pause: true });
        const target = habitatTarget(ID, controller);

        // Start from a selected state so a deselect, if one ever exists, would
        // be observable rather than indistinguishable from the initial state.
        await pinchCreature(ID, target, 150);
        const before = controller.gestureHarnessSnapshot();
        expect(before.selectedId).toBe(target.taskId);

        // Somewhere clear of every creature: well to the side of the habitat
        // and above the ground line. Derived from the live positions so it
        // cannot drift if the habitat is moved.
        const snap = controller.gestureHarnessSnapshot();
        const minX = Math.min(...snap.slots.map((s) => s.worldPosition.x));
        const empty = new vec3(minX - 150, before.slots[0].worldPosition.y + 60, snap.slots[0].worldPosition.z);

        await pinchEmptySpace(ID, empty, 150);

        const after = controller.gestureHarnessSnapshot();
        logOutcome(ID, before, after);

        // Nothing resolved, nothing released — a miss cannot complete a task.
        expect(after.openCount).toBe(before.openCount);
        expect(after.releaseCount).toBe(before.releaseCount);

        // The panel closed. Playbook v3 §3.2.
        expect(after.selectedId).toBe(null);

        // And the hold ring is not left part-filled behind the closed panel.
        expect(after.holdProgress).toBe(0);

        console.log(`[${ID}] PASS — a pinch into empty space deselected ${before.selectedId} and wrote nothing`);
    }
}
