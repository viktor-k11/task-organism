import { nextFrame, sleep } from "Leaf.lspkg/Utils/common/Utils";
import { AiHandInteractor } from "AiPreviewAgentInteract.lspkg/interactor/HandInteractor";
import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";
import { TaskOrganismController } from "../Scripts/Interaction/TaskOrganismController";
import { DemoBeat } from "../Scripts/Interaction/DemoSequence";

/**
 * Gate 6 support — the real input path, driven by a real pinch.
 *
 * WHAT IS DIFFERENT ABOUT THESE SCENARIOS
 * ---------------------------------------
 * Every gate3 scenario calls `pressStart` / `pressEnd` on
 * CreatureInteractionState directly. That verifies the gesture STATE MACHINE
 * and nothing underneath it. The layer it skips — collider geometry, SIK
 * target resolution, the Interactable wiring in `attachInteraction` — has
 * already produced two defects that only hand-testing found:
 *
 *   - buttons left on a default 20x20x20 collider, so SIK could not resolve
 *     which of two adjacent buttons a pinch meant
 *   - a BackPlate whose own collider sat in front of the rows above it and
 *     swallowed their pinches
 *
 * Neither is visible to a test that calls pressStart("demo-1") by hand. Both
 * are visible to a pinch that has to find the creature in space.
 *
 * WHY THE PINCH IS DRIVEN FROM INSIDE THE LENS
 * --------------------------------------------
 * The obvious approach — arm the state in one scenario, fire
 * PreviewInteractTool from the agent, assert in a second scenario — does not
 * work, and the reason is worth recording because it is not obvious:
 *
 *   THE LEAF PLUGIN RESETS THE LENS BEFORE EVERY SCENARIO RUN.
 *
 * Verified in the log: an `arm` run passed at 14:46:22, then at 14:46:29 the
 * scenarios re-registered and the story restarted at `beat=CALM t=0.00s`,
 * with no refresh requested by anyone. So a scenario cannot observe anything
 * set up by a previous scenario run, and it cannot observe a gesture injected
 * between two runs — the reset wipes the armed state, the module-scope
 * baseline, and the gesture's effect together.
 *
 * `AiHandInteractor` is the way through. It is the same class
 * PreviewInteractTool drives on the lens side, so a pinch issued through it is
 * the identical event stream: it puppets the hand rig and feeds SIK's real
 * PinchDetector, which then does its own targeting, hover and trigger
 * resolution against the real colliders. The MCP tool is only an RPC wrapper
 * around this. Calling it directly keeps setup, gesture and assertion inside
 * ONE scenario run — which is also what makes these deterministic.
 *
 * WHY BEAT-JUMPING RATHER THAN WAITING
 * ------------------------------------
 * `gestureHarnessJumpTo` reaches a beat by command and holds it there, the
 * same mechanism the golden-image harness uses. Wall-clock waiting would make
 * the creature's position depend on machine load — preview here runs at
 * 0.1-15 fps, so "wait 3 seconds then pinch" is not a repeatable instruction.
 */

/** Frames to let the gesture state machine settle after a pinch releases.
 *  pressEnd runs on the SIK event, but the controller's selection hooks and
 *  the arbiter sync land on the following update. */
const SETTLE_FRAMES = 4;

export interface CreatureTarget {
    taskId: string;
    interactable: Interactable;
    worldPosition: vec3;
}

/**
 * Finds the live composition root by walking the scene, the same way gate4
 * does. Throwing when it is absent matters: a scenario that silently found no
 * controller would pass while testing nothing.
 */
export function findController(): TaskOrganismController {
    const found: TaskOrganismController[] = [];
    const visit = (obj: SceneObject): void => {
        for (const s of obj.getComponents("Component.ScriptComponent")) {
            if (s instanceof TaskOrganismController) found.push(s);
        }
        for (let i = 0; i < obj.getChildrenCount(); i++) visit(obj.getChild(i));
    };
    const rootCount = global.scene.getRootObjectsCount();
    for (let i = 0; i < rootCount; i++) visit(global.scene.getRootObject(i));

    if (found.length !== 1) {
        throw new Error(`expected exactly 1 TaskOrganismController in the scene, found ${found.length}`);
    }
    return found[0];
}

/**
 * Puts the story on `beat` and holds it there (unless `pause` is false, which
 * only the moving-chaser scenario wants).
 */
export function armAt(
    scenarioId: string,
    beat: DemoBeat,
    options: { pause: boolean }
): TaskOrganismController {
    const controller = findController();
    controller.gestureHarnessJumpTo(beat, options.pause);

    const snap = controller.gestureHarnessSnapshot();
    if (snap.slots.length === 0) throw new Error(`[${scenarioId}] no creature slots alive — nothing to pinch`);

    /* DemoSequence.advanceTo only moves FORWARD. If the story has already run
     * past the target beat the jump is a no-op and the state freezes wherever
     * it happened to be, quietly testing something other than the named beat.
     * Refuse rather than mislead. */
    if (snap.beat !== beat) {
        throw new Error(
            `[${scenarioId}] wanted beat ${beat} but the story is at ${snap.beat}. ` +
                `The timeline cannot rewind — the Lens must be reset before this scenario.`
        );
    }

    console.log(
        `[${scenarioId}] ARMED beat=${snap.beat} paused=${options.pause} ` +
            `selected=${snap.selectedId} open=${snap.openCount} releases=${snap.releaseCount} chaser=${snap.chaserId}`
    );
    return controller;
}

/** A creature currently resting in the habitat (i.e. not the chaser). */
export function habitatTarget(scenarioId: string, controller: TaskOrganismController): CreatureTarget {
    const snap = controller.gestureHarnessSnapshot();
    const slot = snap.slots.find((s) => !s.isChaser);
    if (!slot) throw new Error(`[${scenarioId}] every creature is chasing — no habitat creature to pinch`);
    return resolveTarget(scenarioId, controller, slot.taskId, slot.worldPosition);
}

/** The single approaching creature. */
export function chaserTarget(scenarioId: string, controller: TaskOrganismController): CreatureTarget {
    const snap = controller.gestureHarnessSnapshot();
    const slot = snap.slots.find((s) => s.isChaser);
    if (!slot) {
        throw new Error(
            `[${scenarioId}] expected an active chaser at beat ${snap.beat} but none is selected. ` +
                `Chaser selection requires urgency past CHASE_THRESHOLD.`
        );
    }
    return resolveTarget(scenarioId, controller, slot.taskId, slot.worldPosition);
}

function resolveTarget(
    scenarioId: string,
    controller: TaskOrganismController,
    taskId: string,
    worldPosition: vec3
): CreatureTarget {
    const interactable = controller.gestureHarnessInteractableOf(taskId);
    if (!interactable) {
        throw new Error(
            `[${scenarioId}] task ${taskId} has no Interactable — attachInteraction did not wire this creature`
        );
    }
    console.log(
        `[${scenarioId}] TARGET task=${taskId} ` +
            `world=${worldPosition.x.toFixed(1)},${worldPosition.y.toFixed(1)},${worldPosition.z.toFixed(1)}`
    );
    return { taskId, interactable, worldPosition };
}

/**
 * Builds the hand puppet. Retries across frames because SIK registers its hand
 * interactors during ScriptComponent boot, and a scenario can start before
 * that finishes — the same window AiPreviewAgentInteract guards internally.
 */
async function handInteractor(): Promise<AiHandInteractor> {
    let lastError: unknown;
    for (let i = 0; i < 15; i++) {
        try {
            return new AiHandInteractor("right");
        } catch (e) {
            lastError = e;
            await nextFrame();
        }
    }
    throw lastError instanceof Error ? lastError : new Error("SIK hand interactor never became available");
}

/**
 * A real pinch on a creature: puppets the hand, drives SIK's PinchDetector,
 * and lets SIK resolve the target against the real collider.
 *
 * `durationMs` is how long the pinch is held. Under RESOLVE_HOLD_DURATION_S
 * this is a select or an early-release cancel; over it, a completion.
 */
export async function pinchCreature(
    scenarioId: string,
    target: CreatureTarget,
    durationMs: number
): Promise<void> {
    const interactor = await handInteractor();
    console.log(`[${scenarioId}] PINCH task=${target.taskId} durationMs=${durationMs}`);
    await interactor.pinchInteractable(target.interactable, false, durationMs);
    await settle();
}

/**
 * A real pinch at a point in space with no creature at it. Goes through the
 * same targeting path, so if a collider is oversized this WILL find it.
 */
export async function pinchEmptySpace(
    scenarioId: string,
    position: vec3,
    durationMs: number
): Promise<void> {
    const interactor = await handInteractor();
    console.log(
        `[${scenarioId}] PINCH empty space at ${position.x.toFixed(1)},${position.y.toFixed(1)},${position.z.toFixed(1)}`
    );
    await interactor.pinch(position, false, durationMs);
    await settle();
}

/** Lets the release propagate through pressEnd, the selection hooks and the
 *  arbiter sync before anything is asserted. */
export async function settle(): Promise<void> {
    for (let i = 0; i < SETTLE_FRAMES; i++) await nextFrame();
    await sleep(0.05);
}

/** Prints the before/after pair so a failing run shows what moved, not just
 *  which assertion threw. */
export function logOutcome(
    scenarioId: string,
    before: ReturnType<TaskOrganismController["gestureHarnessSnapshot"]>,
    after: ReturnType<TaskOrganismController["gestureHarnessSnapshot"]>
): void {
    console.log(
        `[${scenarioId}] OUTCOME selected=${before.selectedId}->${after.selectedId} ` +
            `open=${before.openCount}->${after.openCount} ` +
            `releases=${before.releaseCount}->${after.releaseCount} ` +
            `holdProgress=${after.holdProgress.toFixed(2)} beat=${after.beat}`
    );
}
