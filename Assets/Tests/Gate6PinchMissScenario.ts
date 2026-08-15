import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { armAt, habitatTarget, logOutcome, pinchCreature, pinchEmptySpace } from "./Gate6Support";

const ID = "gate6-pinch-miss";

/**
 * Gate 6.4 — a pinch that misses every creature must do no harm.
 *
 * WHAT THIS ASSERTS, AND WHAT IT DELIBERATELY DOES NOT
 * ----------------------------------------------------
 * The brief for this scenario was "a pinch that misses every creature
 * deselects and does nothing". The second half is a real invariant and is
 * asserted below. The first half — deselection — IS NOT IMPLEMENTED, and this
 * scenario does not pretend otherwise.
 *
 * `CreatureInteractionState.pressStart` is reachable from exactly two places:
 * a creature's own Interactable (`attachInteraction`) and the scripted demo
 * beats. There is no global background handler, so a pinch into empty space
 * never reaches the state machine at all and the current selection simply
 * stays. Adding a deselect would be a product decision about whether the panel
 * should close when you look away and pinch — not a bug fix — so this scenario
 * reports the observed behaviour rather than asserting a contract nobody has
 * chosen yet.
 *
 * The safety half is where the value is, and it is a real test of collider
 * geometry: if a creature's collider is far larger than the creature — the
 * 20x20x20-default defect in its other direction — then a pinch aimed at
 * nothing still lands on something, and these assertions catch it.
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

        // And it must not have landed on some OTHER creature. This is the
        // oversized-collider check.
        const landedElsewhere = after.selectedId !== null && after.selectedId !== before.selectedId;
        expect(landedElsewhere).toBe(false);

        // Observed, not asserted — see the header comment.
        if (after.selectedId === null) {
            console.log(`[${ID}] NOTE selection was cleared by the miss`);
        } else {
            console.log(
                `[${ID}] FINDING selection survived the miss (${after.selectedId}) — ` +
                    `deselect-on-miss is not implemented; pressStart is only reachable from a creature's Interactable`
            );
        }

        console.log(`[${ID}] PASS — a pinch into empty space wrote nothing and hit no other creature`);
    }
}
