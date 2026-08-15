import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { RESOLVE_HOLD_DURATION_S } from "../Scripts/Config/CreatureConfig";
import { armAt, habitatTarget, logOutcome, pinchCreature } from "./Gate6Support";

const ID = "gate6-pinch-early-release";

/**
 * Gate 6.3 — letting go early cancels, with no consequence.
 *
 * This is the promise that protects a user from completing something by
 * accident: a hold most of the way to the threshold, then released, must leave
 * the world exactly as it found it — and must not quietly bank the progress so
 * the next hold finishes early.
 */
@component
export class Gate6EarlyReleaseScenario extends Scenario {
    async run(): Promise<void> {
        const controller = armAt(ID, "CALM", { pause: true });
        const target = habitatTarget(ID, controller);

        // Select first, so the next press is a genuine "resolve" role rather
        // than another select. Baseline is taken AFTER this, because the
        // property under test is about the hold, not the select.
        await pinchCreature(ID, target, 150);
        const before = controller.gestureHarnessSnapshot();
        expect(before.selectedId).toBe(target.taskId);

        // Deliberately under the threshold: long enough to start filling the
        // ring, short enough to cancel.
        const earlyMs = Math.round(RESOLVE_HOLD_DURATION_S * 1000 * 0.5);
        await pinchCreature(ID, target, earlyMs);

        const after = controller.gestureHarnessSnapshot();
        logOutcome(ID, before, after);

        // Nothing written, nothing released. This is the whole promise.
        expect(after.openCount).toBe(before.openCount);
        expect(after.releaseCount).toBe(before.releaseCount);

        // "No consequence" includes keeping the selection: an early release is
        // a cancelled completion, not a dismissal.
        expect(after.selectedId).toBe(target.taskId);

        // The ring must be reset, not left part-filled.
        expect(after.holdProgress).toBe(0);

        console.log(
            `[${ID}] PASS — ${earlyMs}ms hold cancelled: ${after.selectedId} still selected, nothing written, progress reset`
        );
    }
}
