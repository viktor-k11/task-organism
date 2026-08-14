import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { DemoClock } from "../Scripts/Data/Clock";
import { TaskRepository } from "../Scripts/Data/TaskRepository";
import { StateEngine } from "../Scripts/State/StateEngine";
import { AttentionArbiter } from "../Scripts/State/AttentionArbiter";
import { TaskResolutionService } from "../Scripts/State/TaskResolutionService";
import { CreatureBehavior } from "../Scripts/Creature/CreatureBehavior";
import { TaskOrganismController } from "../Scripts/Interaction/TaskOrganismController";
import { CountingTaskStorage, gateTask } from "./Gate2Support";

/**
 * Gate 4 — the composition root must outlive a release.
 *
 * WHY THIS SCENARIO EXISTS
 * ------------------------
 * TaskOrganismController used to be a ScriptComponent on MovementRoot_1, a
 * creature slot. CreatureBehavior.release() finishes by disabling its own
 * sceneObject. So completing the FIRST task disabled the object hosting the
 * controller, and every per-frame system stopped at once: arbiter sync, demo
 * beats, gesture updates, capacity logging.
 *
 * All twelve existing scenarios passed the entire time that bug was live. They
 * exercise the DOMAIN — repository, state engine, arbiter, resolution — as
 * plain TypeScript, and never look at the scene object graph or at what owns
 * what. A pure-domain suite cannot see a lifetime bug, because from the
 * domain's point of view nothing was wrong: the task did resolve, exactly once,
 * and the arbiter would have re-selected correctly if anything had still been
 * calling it.
 *
 * It also hid in plain sight in the logs, because the scripted story ENDS at
 * release. A log that stops because everything died and a log that stops
 * because the story finished look identical.
 *
 * So this scenario closes the gap explicitly, in two halves:
 *   Part 1 (structural) is the actual regression lock — it fails if the
 *          composition root is ever hosted on something that can disable itself.
 *   Part 2 (behavioural) is the property the user cares about — after one task
 *          is released, the arbiter still promotes a second and it can still be
 *          resolved.
 */
@component
export class Gate4ControllerSurvivesReleaseScenario extends Scenario {
    async run(): Promise<void> {
        // ── Part 1: the composition root is not parked on a creature ────────
        const controllerHosts: SceneObject[] = [];
        const creatureHosts: SceneObject[] = [];
        const visit = (obj: SceneObject): void => {
            const scripts = obj.getComponents("Component.ScriptComponent");
            for (const s of scripts) {
                if (s instanceof TaskOrganismController) controllerHosts.push(obj);
                if (s instanceof CreatureBehavior) creatureHosts.push(obj);
            }
            for (let i = 0; i < obj.getChildrenCount(); i++) visit(obj.getChild(i));
        };
        const rootCount = global.scene.getRootObjectsCount();
        for (let i = 0; i < rootCount; i++) visit(global.scene.getRootObject(i));

        // Finding nothing must FAIL rather than vacuously pass — a scenario
        // that silently checks zero objects is worse than no scenario.
        expect(controllerHosts.length).toBe(1);
        expect(creatureHosts.length > 0).toBe(true);

        const host = controllerHosts[0];
        const isCreature = creatureHosts.some((c) => c.uniqueIdentifier === host.uniqueIdentifier);
        expect(isCreature).toBe(false);

        // ...and not a descendant of one either, since disabling a parent
        // disables the whole subtree.
        let ancestor = host.getParent();
        let underCreature = false;
        while (ancestor) {
            if (creatureHosts.some((c) => c.uniqueIdentifier === ancestor!.uniqueIdentifier)) underCreature = true;
            ancestor = ancestor.getParent();
        }
        expect(underCreature).toBe(false);
        expect(host.enabled).toBe(true);
        console.log(`[Gate4] composition root lives on "${host.name}", which is not a creature slot and not under one`);

        // ── Part 2: a second task is still selectable and resolvable ────────
        const storage = new CountingTaskStorage();
        storage.tasks = [
            gateTask("first", "First task", 0),
            gateTask("second", "Second task", 0),
        ];
        const clock = new DemoClock(0);
        const repository = new TaskRepository(storage, clock);
        repository.restore();
        const engine = new StateEngine(clock);
        const arbiter = new AttentionArbiter(engine);
        const released: string[] = [];
        const resolution = new TaskResolutionService(repository, (id) => released.push(id));

        // Age both past CHASE_THRESHOLD so the arbiter has a real choice.
        clock.setNowMs(86400000 * 2);
        const firstChaser = arbiter.selectChaser(repository.listOpen());
        expect(firstChaser !== null).toBe(true);

        expect(resolution.resolve(firstChaser!.id)).toBe(true);
        expect(released.length).toBe(1);

        // The point of the whole scenario: after a release the system keeps
        // working — a NEW chaser is promoted, it is a different task, and it
        // resolves too.
        const open = repository.listOpen();
        expect(open.length).toBe(1);
        const secondChaser = arbiter.selectChaser(open);
        expect(secondChaser !== null).toBe(true);
        expect(secondChaser!.id === firstChaser!.id).toBe(false);
        expect(resolution.resolve(secondChaser!.id)).toBe(true);
        expect(released.length).toBe(2);
        expect(repository.listOpen().length).toBe(0);

        console.log(`[Gate4] released ${released[0]} then ${released[1]} — arbiter promoted a second chaser after the first release`);
    }
}
