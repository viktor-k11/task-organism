import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { RESOLVE_HOLD_DURATION_S } from "../Scripts/Config/CreatureConfig";
import { armAt, chaserTarget, logOutcome, MIN_TRAVEL_CM, pinchCreature, travelOf } from "./Gate6Support";

const ID = "gate6-moving-chaser-hold";

/**
 * Gate 6.6 — can the approaching creature be HELD THROUGH TO COMPLETION while
 * it is still moving?
 *
 * THE PRODUCT'S CENTRAL GESTURE
 * -----------------------------
 * `gate6-moving-chaser` proves a moving creature can be ACQUIRED — a short
 * pinch selects it. That is not the same question, and it is not the one the
 * project's own notes flagged. prompts.md records that "a subsequent synthetic
 * hold could not reacquire the moving target", while a hold against the same
 * body once STATIONARY worked reliably. The recorded limitation is about the
 * hold, and this scenario is the one that answers it.
 *
 * It matters more than the short pinch because it is the gesture the product
 * is built around: a creature walks toward you asking for attention, and you
 * answer it by holding. If that only works once the creature has finished
 * arriving, the user has to wait out the approach before they can respond —
 * which would be a real defect, not a test artefact.
 *
 * SELECT FIRST, THEN RELEASE THE APPROACH — AND THE ORDER IS THE POINT
 * --------------------------------------------------------------------
 * The obvious sequence (jump to APPROACH, select, hold) does not test what it
 * claims. Measured: the approach from the habitat to `chaseStopDistanceCm`
 * finishes in less time than a select-plus-settle takes, so the creature had
 * already arrived by the time the hold began — 0.3cm of travel during the
 * hold, against 4.7cm across the whole gesture. A pass there would have proved
 * only that a STATIONARY creature can be held.
 *
 * So the selection is made while the story is still frozen at CALM, and the
 * approach is released immediately before the hold. The creature is then
 * moving for the whole of the gesture under test.
 */
@component
export class Gate6MovingChaserHoldScenario extends Scenario {
    async run(): Promise<void> {
        // Frozen at CALM: the chaser is already chosen by the arbiter but has
        // not begun closing distance.
        const controller = armAt(ID, "CALM", { pause: true });
        const target = chaserTarget(ID, controller);
        const before = controller.gestureHarnessSnapshot();

        // Select while still: role is frozen at press time, so a hold on an
        // unselected creature would only ever be another select. Doing this
        // now keeps the whole approach available for the hold itself.
        await pinchCreature(ID, target, 150);
        expect(controller.gestureHarnessSnapshot().selectedId).toBe(target.taskId);

        // Release the approach. From here the creature is walking toward the
        // camera, and the snapshot below is the start of the moving window.
        controller.gestureHarnessJumpTo("APPROACH", false);
        const selected = controller.gestureHarnessSnapshot();

        // The hold, on a creature that is closing distance throughout.
        await pinchCreature(ID, target, Math.round(RESOLVE_HOLD_DURATION_S * 1000) + 1200);

        const after = controller.gestureHarnessSnapshot();
        logOutcome(ID, before, after);

        const travelDuringHold = travelOf(selected.slots, after.slots, target.taskId);
        const travelTotal = travelOf(before.slots, after.slots, target.taskId);
        console.log(
            `[${ID}] chaser travelled ${travelDuringHold.toFixed(1)}cm during the hold ` +
                `(${travelTotal.toFixed(1)}cm across the whole gesture)`
        );

        // Re-pause before asserting, so a failure does not leave the story
        // running on into whatever executes next.
        controller.gestureHarnessPause();

        // The creature was genuinely in motion while held — otherwise this is
        // just gate6-pinch-hold-resolve wearing a different name.
        expect(travelDuringHold >= MIN_TRAVEL_CM).toBe(true);

        // The property under test: the hold completed.
        expect(after.releaseCount).toBe(before.releaseCount + 1);
        expect(after.openCount).toBe(before.openCount - 1);
        expect(after.selectedId).toBe(null);

        console.log(
            `[${ID}] PASS — the approaching chaser ${target.taskId} was held to completion while moving ` +
                `${travelDuringHold.toFixed(1)}cm: one release, open ${before.openCount}->${after.openCount}`
        );
    }
}
