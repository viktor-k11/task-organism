import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";
import { RESOLVE_HOLD_DURATION_S } from "../Config/CreatureConfig";
import { RealClock } from "../Data/Clock";
import { PersistentTaskStorage } from "../Data/TaskStorage";
import { TaskRepository } from "../Data/TaskRepository";
import { CreatureBehavior } from "../Creature/CreatureBehavior";
import { findChildByName } from "../Creature/CreatureMovement";
import { DemoInput } from "../Input/DemoInput";
import { KeyboardInput } from "../Input/KeyboardInput";
import { SequentialTaskIdentitySource, TaskCreationService } from "../Input/TaskCreationService";
import { TaskResolutionService } from "../State/TaskResolutionService";
import { CreatureInteractionState } from "./CreatureInteractionState";
import { TaskSelectionView } from "./TaskSelectionView";

/** Runtime Gate 3 bridge: repository/input -> one technical creature -> SIK/UI. */
@component
export class TaskOrganismController extends BaseScriptComponent {
    private repository!: TaskRepository;
    private creature!: CreatureBehavior;
    private state!: CreatureInteractionState;
    private view!: TaskSelectionView;
    private keyboard!: KeyboardInput;
    private boundTaskId: string | null = null;

    onAwake(): void {
        this.createEvent("OnStartEvent").bind(() => this.onStart());
        this.createEvent("UpdateEvent").bind(() => {
            if (this.state) this.state.update(getDeltaTime());
        });
        this.createEvent("KeyPressEvent").bind((event: KeyPressEvent) => {
            if (event.key === Keys.K && this.keyboard) this.keyboard.show();
        });
    }

    private onStart(): void {
        this.creature = this.sceneObject.getComponent(CreatureBehavior.getTypeName()) as CreatureBehavior;
        const visualRoot = findChildByName(this.sceneObject, "VisualRoot");
        const body = visualRoot ? findChildByName(visualRoot, "Body") : null;
        if (!this.creature || !visualRoot || !body) {
            console.error("[TaskOrganismController] CreatureBehavior/VisualRoot/Body missing");
            return;
        }

        const clock = new RealClock();
        this.repository = new TaskRepository(new PersistentTaskStorage(), clock);
        let tasks = this.repository.restore();
        const creator = new TaskCreationService(this.repository, clock, new SequentialTaskIdentitySource("task", tasks.length));
        const demo = new DemoInput(creator);
        this.keyboard = new KeyboardInput(creator);
        if (tasks.length === 0) tasks = demo.seedFixtures();
        if (tasks.length === 0) return;
        this.boundTaskId = tasks[0].id;

        let stateRef: CreatureInteractionState | null = null;
        this.view = new TaskSelectionView(visualRoot, () => {
            if (stateRef?.later()) this.creature.endChase();
        });
        this.view.setTaskText(tasks[0].text);

        const resolution = new TaskResolutionService(this.repository, (_taskId) => this.creature.release());
        this.state = new CreatureInteractionState(this.repository, resolution, {
            onSelectionChanged: (taskId) => this.view.setSelected(taskId !== null),
            onResolveProgress: (progress) => this.view.setProgress(progress),
        });
        stateRef = this.state;

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

        // This method itself runs inside OnStartEvent, after SIK initialization.
        interactable.onTriggerStart.add(() => {
            if (this.boundTaskId) this.state.pressStart(this.boundTaskId);
        });
        interactable.onTriggerEnd.add(() => this.state.pressEnd());
        interactable.onTriggerEndOutside.add(() => this.state.pressEnd());
        interactable.onTriggerCanceled.add(() => this.state.pressEnd());
        console.log(`[TaskOrganismController] ready; hold=${RESOLVE_HOLD_DURATION_S}s; press K for keyboard input`);
    }
}
