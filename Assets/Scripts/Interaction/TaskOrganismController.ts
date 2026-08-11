import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";
import {
    HABITAT_HOME_DEPTH_CM,
    HABITAT_HOME_FLOOR_Y_CM,
    HABITAT_HOME_LATERAL_SPACING_CM,
    HABITAT_HOME_GROUP_LATERAL_CM,
    HABITAT_HOME_SIDE_DEPTH_OFFSET_CM,
    HABITAT_HOME_WANDER_RADIUS_CM,
    RESOLVE_HOLD_DURATION_S,
    URGENCY_AGE_WINDOW_MS,
} from "../Config/CreatureConfig";
import { DemoClock } from "../Data/Clock";
import { PersistentTaskStorage } from "../Data/TaskStorage";
import { TaskRecord } from "../Data/TaskRecord";
import { TaskRepository } from "../Data/TaskRepository";
import { CreatureBehavior } from "../Creature/CreatureBehavior";
import { findChildByName } from "../Creature/CreatureMovement";
import { DEMO_TASK_FIXTURES, DemoInput } from "../Input/DemoInput";
import { KeyboardInput } from "../Input/KeyboardInput";
import { SequentialTaskIdentitySource, TaskCreationService } from "../Input/TaskCreationService";
import { AttentionArbiter } from "../State/AttentionArbiter";
import { StateEngine } from "../State/StateEngine";
import { TaskResolutionService } from "../State/TaskResolutionService";
import { CreatureInteractionState } from "./CreatureInteractionState";
import { DemoControlView } from "./DemoControlView";
import { TaskSelectionView } from "./TaskSelectionView";
import { buildHabitatFloor } from "./HabitatFloor";

// v4: staggered creation times changed (see seedStaggeredDemoTasks) so a
// single "Advance Demo Time" press now produces one of each behavior state
// (CALM/URGENT/CHASING) instead of only CALM/CHASING — bump forces a reseed
// so a v3 demo save (different creation times) can't produce stale ages.
const DEMO_STORAGE_KEY = "task-organism.wednesday-demo.v4.presentation";
/**
 * Fractions of URGENCY_AGE_WINDOW_MS (the CHASE_THRESHOLD crossing point).
 * Chosen so that at seed-end (clock = DEMO_TASK2_CREATED_AT_MS) every task's
 * age is still below the threshold (all calm, matching the initial demo
 * status text), and after advancing to DEMO_ADVANCE_TARGET_MS the three
 * tasks land in three different behavior states with comfortable margins:
 * task0 age 1.8W (highest urgency -> chaser), task1 age 1.4W (eligible but
 * lower urgency -> URGENT, not selected), task2 age 0.9W (-> still CALM).
 */
const DEMO_TASK1_CREATED_AT_MS = URGENCY_AGE_WINDOW_MS * 0.4;
const DEMO_TASK2_CREATED_AT_MS = URGENCY_AGE_WINDOW_MS * 0.9;
const DEMO_TASK_CREATION_TIMES_MS = [0, DEMO_TASK1_CREATED_AT_MS, DEMO_TASK2_CREATED_AT_MS];
const DEMO_ADVANCE_TARGET_MS = URGENCY_AGE_WINDOW_MS * 1.8;
const SLOT_NAMES = ["MovementRoot_1", "MovementRoot_2", "MovementRoot_3"];

interface CreatureSlot {
    taskId: string;
    root: SceneObject;
    creature: CreatureBehavior;
    view: TaskSelectionView;
}

/** Wednesday vertical-slice coordinator. Domain and gesture logic stay delegated. */
@component
export class TaskOrganismController extends BaseScriptComponent {
    private repository!: TaskRepository;
    private clock!: DemoClock;
    private stateEngine!: StateEngine;
    private arbiter!: AttentionArbiter;
    private interaction!: CreatureInteractionState;
    private keyboard!: KeyboardInput;
    private demoControl!: DemoControlView;
    private slots: CreatureSlot[] = [];
    private activeChaserId: string | null = null;
    private heldInteractionId: string | null = null;
    private demoAdvanced = false;
    private resolveProgressMilestone = 0;

    onAwake(): void {
        this.createEvent("OnStartEvent").bind(() => this.onStart());
        this.createEvent("UpdateEvent").bind(() => this.onUpdate());
        this.createEvent("KeyPressEvent").bind((event: KeyPressEvent) => {
            if (event.key === Keys.K && this.keyboard) this.keyboard.show();
            if (event.key === Keys.R) {
                global.persistentStorageSystem.store.remove(DEMO_STORAGE_KEY);
                console.log("[WednesdayDemo] cleared demo storage; restart Preview to reseed");
            }
        });
    }

    private onStart(): void {
        this.clock = new DemoClock(0);
        this.repository = new TaskRepository(new PersistentTaskStorage(global.persistentStorageSystem.store, DEMO_STORAGE_KEY), this.clock);
        let tasks = this.repository.restore();
        if (tasks.length > 0) this.clock.setNowMs(this.latestCreationTime(tasks));

        const creator = new TaskCreationService(this.repository, this.clock, new SequentialTaskIdentitySource("demo", tasks.length));
        const demo = new DemoInput(creator);
        this.keyboard = new KeyboardInput(creator);
        if (tasks.length === 0) tasks = this.seedStaggeredDemoTasks(demo);

        this.stateEngine = new StateEngine(this.clock);
        this.arbiter = new AttentionArbiter(this.stateEngine);
        const resolution = new TaskResolutionService(this.repository, (taskId) => this.releaseTask(taskId));
        this.interaction = new CreatureInteractionState(this.repository, resolution, {
            onSelectionChanged: (taskId) => this.onSelectionChanged(taskId),
            onResolveProgress: (progress) => this.onResolveProgress(progress),
        });

        this.bindCreatureSlots(tasks);
        const cameraObject = this.findSceneObject("Camera Object");
        if (cameraObject) buildHabitatFloor(cameraObject);
        else console.error("[WednesdayDemo] Camera Object not found — habitat floor not built.");
        this.demoControl = new DemoControlView(() => this.advanceDemoTime());
        this.demoControl.setStatus(`${tasks.length} tasks • all calm`);
        this.syncArbiter();
        console.log(`[WednesdayDemo] ready open=${tasks.length} hold=${RESOLVE_HOLD_DURATION_S}s chaser=none`);
    }

    private onUpdate(): void {
        if (!this.interaction) return;
        this.interaction.update(getDeltaTime());
        this.syncArbiter();
    }

    private seedStaggeredDemoTasks(demo: DemoInput): TaskRecord[] {
        const created: TaskRecord[] = [];
        for (let i = 0; i < DEMO_TASK_FIXTURES.length; i++) {
            this.clock.setNowMs(DEMO_TASK_CREATION_TIMES_MS[i]);
            const task = demo.submit(DEMO_TASK_FIXTURES[i]);
            if (task) created.push(task);
        }
        return created;
    }

    private bindCreatureSlots(tasks: TaskRecord[]): void {
        const roots = SLOT_NAMES.map((name) => this.findSceneObject(name)).filter((root) => root !== null) as SceneObject[];
        if (roots.length !== SLOT_NAMES.length) {
            console.error(`[WednesdayDemo] expected ${SLOT_NAMES.length} creature roots, found ${roots.length}`);
            return;
        }

        for (let i = 0; i < roots.length; i++) {
            const root = roots[i];
            const task = tasks[i];
            if (!task) {
                root.enabled = false;
                continue;
            }
            root.enabled = true;
            const creature = root.getComponent(CreatureBehavior.getTypeName()) as CreatureBehavior;
            const visualRoot = findChildByName(root, "VisualRoot");
            const body = visualRoot ? findChildByName(visualRoot, "Body") : null;
            if (!creature || !visualRoot || !body) {
                console.error(`[WednesdayDemo] incomplete creature slot ${i + 1}`);
                continue;
            }

            const view = new TaskSelectionView(visualRoot, () => {
                if (this.interaction.selectedId === task.id && this.interaction.later()) {
                    creature.endChase();
                    this.demoControl.setStatus(`${this.repository.listOpen().length} tasks • deferred`);
                }
            });
            view.setTaskText(task.text);
            creature.setHabitatHome(
                HABITAT_HOME_GROUP_LATERAL_CM + (i - 1) * HABITAT_HOME_LATERAL_SPACING_CM,
                HABITAT_HOME_DEPTH_CM + (i === 1 ? HABITAT_HOME_SIDE_DEPTH_OFFSET_CM : 0),
                HABITAT_HOME_FLOOR_Y_CM,
                HABITAT_HOME_WANDER_RADIUS_CM,
            );
            this.attachInteraction(body, task.id);
            this.slots.push({ taskId: task.id, root, creature, view });
            console.log(`[WednesdayEvidence] habitat task=${task.id} slot=${i + 1} lateral=${HABITAT_HOME_GROUP_LATERAL_CM + (i - 1) * HABITAT_HOME_LATERAL_SPACING_CM}`);
        }
    }

    private attachInteraction(body: SceneObject, taskId: string): void {
        let collider = body.getComponent("Physics.ColliderComponent") as ColliderComponent;
        if (!collider) {
            collider = body.createComponent("Physics.ColliderComponent") as ColliderComponent;
            const shape = Shape.createBoxShape();
            shape.size = new vec3(34, 39, 30);
            collider.shape = shape;
        }
        let interactable = body.getComponent(Interactable.getTypeName()) as Interactable;
        if (!interactable) interactable = body.createComponent(Interactable.getTypeName()) as Interactable;
        interactable.targetingMode = 3;
        interactable.onTriggerStart.add(() => this.interaction.pressStart(taskId));
        interactable.onTriggerEnd.add(() => this.interaction.pressEnd());
        interactable.onTriggerEndOutside.add(() => this.interaction.pressEnd());
        interactable.onTriggerCanceled.add(() => this.interaction.pressEnd());
    }

    private advanceDemoTime(): void {
        if (this.demoAdvanced) return;
        this.demoAdvanced = true;
        this.clock.setNowMs(DEMO_ADVANCE_TARGET_MS);
        this.syncArbiter();
        this.demoControl.setAdvanced(true);
        this.demoControl.setStatus("1 chasing • 1 restless • 1 calm");
        console.log(`[WednesdayDemo] time advanced now=${this.clock.nowMs()} chaser=${this.activeChaserId}`);
    }

    private syncArbiter(): void {
        const openTasks = this.repository.listOpen();
        const selected = this.arbiter.selectChaser(openTasks);
        const nextId = selected ? selected.id : null;
        if (nextId !== this.activeChaserId) {
            this.activeChaserId = nextId;
            for (const slot of this.slots) {
                if (slot.taskId === nextId) slot.creature.requestChase();
                else slot.creature.endChase();
            }
            console.log(`[WednesdayDemo] arbiter chaser=${nextId ?? "none"}`);
        }

        // Presentation-only CALM/URGENT signal for every non-chasing slot —
        // derived fresh each frame straight from StateEngine (never persisted,
        // per CLAUDE.md invariant 1). The chaser's own creature ignores this
        // flag while CHASING/INTERACTING, so it's harmless to still send it.
        // setUrgencyLevel01 sends the raw continuous value (0 at creation, 1 at
        // CHASE_THRESHOLD) for the whole-body growth channel — StateEngine.urgency
        // is already public and used by AttentionArbiter itself; this only reads
        // it, it does not change StateEngine/AttentionArbiter behavior.
        for (const slot of this.slots) {
            const task = openTasks.find((candidate) => candidate.id === slot.taskId);
            if (!task) continue;
            slot.creature.setUrgent(this.stateEngine.deriveState(task, slot.taskId === nextId) === "URGENT");
            slot.creature.setUrgencyLevel01(this.stateEngine.urgency(task));
        }
    }

    private onSelectionChanged(taskId: string | null): void {
        for (const slot of this.slots) slot.view.setSelected(slot.taskId === taskId);
        if (taskId) {
            const slot = this.slots.find((candidate) => candidate.taskId === taskId);
            if (slot) {
                slot.creature.holdForInteraction();
                this.heldInteractionId = taskId;
                console.log(`[WednesdayEvidence] selected task=${taskId} chaseHeld=true`);
            }
        } else if (this.heldInteractionId) {
            const held = this.slots.find((candidate) => candidate.taskId === this.heldInteractionId);
            if (held) held.creature.endChase();
            this.heldInteractionId = null;
        }
    }

    private onResolveProgress(progress: number): void {
        const selectedId = this.interaction ? this.interaction.selectedId : null;
        for (const slot of this.slots) {
            if (slot.taskId === selectedId) slot.view.setProgress(progress);
        }
        if (progress <= 0) {
            this.resolveProgressMilestone = 0;
            return;
        }
        const milestone = Math.min(100, Math.floor(progress * 4) * 25);
        if (milestone > this.resolveProgressMilestone) {
            this.resolveProgressMilestone = milestone;
            console.log(`[WednesdayEvidence] hold progress=${milestone}% task=${selectedId ?? "none"}`);
        }
    }

    private releaseTask(taskId: string): void {
        const slot = this.slots.find((candidate) => candidate.taskId === taskId);
        const remaining = this.repository.listOpen().length;
        console.log(`[WednesdayDemo] repository saved completion task=${taskId} open=${remaining}`);
        if (slot) slot.creature.release();
        console.log(`[WednesdayEvidence] release requested task=${taskId} remaining=${remaining}`);
        this.activeChaserId = null;
        this.demoControl.setStatus(`${remaining} tasks remaining`);
    }

    private latestCreationTime(tasks: TaskRecord[]): number {
        let latest = 0;
        for (const task of tasks) latest = Math.max(latest, task.createdAtMs);
        return latest;
    }

    private findSceneObject(name: string): SceneObject | null {
        const count = global.scene.getRootObjectsCount();
        for (let i = 0; i < count; i++) {
            const root = global.scene.getRootObject(i);
            if (root.name === name) return root;
        }
        return null;
    }
}
