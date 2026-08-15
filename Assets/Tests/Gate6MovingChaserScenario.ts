import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { armAt, chaserTarget, logOutcome, pinchCreature } from "./Gate6Support";

const ID = "gate6-moving-chaser";

/** Minimum travel during the gesture for this scenario to have tested
 *  anything. At the 0.5 m/s speed cap a 150ms pinch spans up to ~7.5cm, so
 *  2cm is a low bar that still excludes a settled creature. */
const MIN_TRAVEL_CM = 2;

/**
 * Gate 6.5 — can the approaching creature be grabbed while it is still moving?
 *
 * THIS IS A PRODUCT QUESTION, NOT A TEST-PLUMBING ONE
 * ---------------------------------------------------
 * The chaser is the creature a user is most likely to reach for, and it is
 * moving when they reach. If a pinch can only land once it has stopped, that
 * is a real limitation of the experience: the user has to wait for the
 * creature to finish arriving before they can answer it.
 *
 * prompts.md records this as unresolved — a synthetic hold "could not
 * reacquire the moving target", while a second pinch against the same body
 * once stationary worked reliably. That note was never pinned to a cause.
 *
 * So this scenario is deliberately the ONLY one that does not pause the story.
 * The creature keeps closing distance while the pinch is delivered.
 *
 * If it fails, that is a finding to report, not a scenario to work around. The
 * one thing that must not happen is quietly pausing the creature to make it
 * green — that would assert the opposite of the property in question.
 */
@component
export class Gate6MovingChaserScenario extends Scenario {
    async run(): Promise<void> {
        // pause:false is the entire point — see above.
        const controller = armAt(ID, "APPROACH", { pause: false });
        const target = chaserTarget(ID, controller);
        const before = controller.gestureHarnessSnapshot();

        // Targeted by Interactable rather than by a world point, so a stale
        // coordinate cannot be blamed for a miss — SIK resolves the object
        // itself. If this still fails, the limitation is real.
        await pinchCreature(ID, target, 150);

        const after = controller.gestureHarnessSnapshot();
        logOutcome(ID, before, after);

        const moved = distance(before.slots, after.slots, target.taskId);
        console.log(`[${ID}] chaser travelled ${moved.toFixed(1)}cm during the gesture`);

        // Re-pause so a failure does not leave the story galloping into
        // whatever runs next.
        controller.gestureHarnessJumpTo("APPROACH", true);

        /* The creature must actually have been MOVING, or this scenario is
         * only re-testing the stationary case that already works. A chaser
         * that has arrived and settled at its stop distance travels ~0cm, and
         * a pass on that would be indistinguishable from gate6-pinch-select
         * while claiming to prove something stronger. */
        expect(moved >= MIN_TRAVEL_CM).toBe(true);

        // The property under test: the moving chaser was acquired.
        expect(after.selectedId).toBe(target.taskId);

        // A short pinch on it is still only a read.
        expect(after.openCount).toBe(before.openCount);
        expect(after.releaseCount).toBe(before.releaseCount);

        console.log(`[${ID}] PASS — the approaching chaser ${after.selectedId} was acquired while moving ${moved.toFixed(1)}cm`);
    }
}

/** How far the target travelled between the two snapshots — reported so a
 *  pass on a barely-moving creature is not mistaken for a strong result. */
function distance(
    before: { taskId: string; worldPosition: vec3 }[],
    after: { taskId: string; worldPosition: vec3 }[],
    taskId: string
): number {
    const a = before.find((s) => s.taskId === taskId);
    const b = after.find((s) => s.taskId === taskId);
    if (!a || !b) return 0;
    return a.worldPosition.distance(b.worldPosition);
}
