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

const DEMO_STORAGE_KEY = "task-organism.wednesday-demo.v3.presentation";
const DEMO_TASK_SPACING_MS = URGENCY_AGE_WINDOW_MS / 2;
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

        const stateEngine = new StateEngine(this.clock);
        this.arbiter = new AttentionArbiter(stateEngine);
        const resolution = new TaskResolutionService(this.repository, (taskId) => this.releaseTask(taskId));
        this.interaction = new CreatureInteractionState(this.repository, resolution, {
            onSelectionChanged: (taskId) => this.onSelectionChanged(taskId),
            onResolveProgress: (progress) => this.onResolveProgress(progress),
        });

        this.bindCreatureSlots(tasks);
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
        this.clock.setNowMs(0);
        const first = demo.submit(DEMO_TASK_FIXTURES[0]);
        if (first) created.push(first);
        this.clock.setNowMs(DEMO_TASK_SPACING_MS);
        for (let i = 1; i < DEMO_TASK_FIXTURES.length; i++) {
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
        this.clock.advanceMs(DEMO_TASK_SPACING_MS + 1);
        this.syncArbiter();
        this.demoControl.setAdvanced(true);
        this.demoControl.setStatus("1 task needs attention");
        console.log(`[WednesdayDemo] time advanced now=${this.clock.nowMs()} chaser=${this.activeChaserId}`);
    }

    private syncArbiter(): void {
        const selected = this.arbiter.selectChaser(this.repository.listOpen());
        const nextId = selected ? selected.id : null;
        if (nextId === this.activeChaserId) return;
        this.activeChaserId = nextId;
        for (const slot of this.slots) {
            if (slot.taskId === nextId) slot.creature.requestChase();
            else slot.creature.endChase();
        }
        console.log(`[WednesdayDemo] arbiter chaser=${nextId ?? "none"}`);
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
