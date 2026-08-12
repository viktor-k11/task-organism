import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";
import {
    HABITAT_HOME_DEPTH_CM,
    GROUND_Y_OFFSET_CM,
    HABITAT_HOME_LATERAL_SPACING_CM,
    HABITAT_HOME_GROUP_LATERAL_CM,
    HABITAT_HOME_SIDE_DEPTH_OFFSET_CM,
    HABITAT_HOME_WANDER_RADIUS_CM,
    RESOLVE_HOLD_DURATION_S,
    URGENCY_AGE_WINDOW_MS,
    DEMO_AUTOPLAY_ON_START,
    HABITAT_DEPTH_STEP_CM,
    HABITAT_LATERAL_STEP_CM,
    HABITAT_DEPTH_MIN_CM,
    HABITAT_DEPTH_MAX_CM,
    HABITAT_LATERAL_LIMIT_CM,
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
import { DemoBeat, DemoSequence } from "./DemoSequence";
import { DemoControlView } from "./DemoControlView";
import { TaskSelectionView } from "./TaskSelectionView";
import { buildHabitatFloor, positionHabitatFloor } from "./HabitatFloor";

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

function clampRange(value: number, min: number, max: number): number {
    return value < min ? min : value > max ? max : value;
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
    private sequence!: DemoSequence;
    /**
     * Gates the PRESENTATION transition into chase, not chaser selection.
     * AttentionArbiter still picks exactly one chaser the moment urgency
     * crosses the threshold (invariants 3 and 4 are untouched); this only
     * delays when that creature stops presenting as URGENT and starts closing
     * distance, so "becomes urgent" and "approaches" read as two separate
     * beats instead of one blurred motion. Closed again at release so no
     * second creature starts approaching during the closing beat.
     */
    private approachGateOpen = false;
    // ── Staging state (runtime habitat placement, see the key map in onAwake) ──
    private habitatDepthCm = HABITAT_HOME_DEPTH_CM;
    private habitatLateralCm = HABITAT_HOME_GROUP_LATERAL_CM;
    private cameraObject: SceneObject | null = null;
    private floorObject: SceneObject | null = null;

    onAwake(): void {
        this.createEvent("OnStartEvent").bind(() => this.onStart());
        this.createEvent("UpdateEvent").bind(() => this.onUpdate());
        // Staging is driven by on-screen buttons (see DemoControlView), NOT
        // hotkeys. Lens Studio's Preview panel binds the arrow keys, WASD and
        // even plain letters to its own camera fly controls — verified by
        // injection: Up/Up/Right moved the habitat and simultaneously flew the
        // preview camera (yaw -8.5 deg, z +8), and a bare H moved it x -9. A
        // staging control that also moves the viewpoint you are framing with
        // is worse than no control, and there is no keyboard on device anyway.
        this.createEvent("KeyPressEvent").bind((event: KeyPressEvent) => {
            if (event.key === Keys.K && this.keyboard) this.keyboard.show();
            if (event.key === Keys.R) {
                global.persistentStorageSystem.store.remove(DEMO_STORAGE_KEY);
                console.log("[WednesdayDemo] cleared demo storage; restart Preview to reseed");
            }
        });
    }

    // ── Staging: runtime habitat placement ─────────────────────────────────

    private nudgeHabitat(depthDeltaCm: number, lateralDeltaCm: number): void {
        this.habitatDepthCm = clampRange(
            this.habitatDepthCm + depthDeltaCm, HABITAT_DEPTH_MIN_CM, HABITAT_DEPTH_MAX_CM);
        this.habitatLateralCm = clampRange(
            this.habitatLateralCm + lateralDeltaCm, -HABITAT_LATERAL_LIMIT_CM, HABITAT_LATERAL_LIMIT_CM);
        this.applyHabitatLayout();
    }

    /**
     * Re-anchors the habitat to the camera's CURRENT pose, keeping the current
     * depth/lateral. Use after moving or turning to bring the group back into
     * a clear part of the room.
     */
    private recenterHabitat(): void {
        this.applyHabitatLayout();
        console.log(`[WednesdayStaging] recentered depth=${this.habitatDepthCm} lateral=${this.habitatLateralCm}`);
    }

    /**
     * Pushes the current depth/lateral to every creature AND the floor disc.
     * Both must be updated together — moving one without the other is exactly
     * how the floor and the creatures' foot line drifted apart before.
     * setHabitatHome re-reads the live camera pose, so this doubles as recenter.
     */
    private applyHabitatLayout(): void {
        for (let i = 0; i < this.slots.length; i++) {
            this.slots[i].creature.setHabitatHome(
                this.habitatLateralCm + (i - 1) * HABITAT_HOME_LATERAL_SPACING_CM,
                this.habitatDepthCm + (i === 1 ? HABITAT_HOME_SIDE_DEPTH_OFFSET_CM : 0),
                GROUND_Y_OFFSET_CM,
                HABITAT_HOME_WANDER_RADIUS_CM,
            );
            this.slots[i].creature.recenterHabitat();
        }
        if (this.floorObject && this.cameraObject) {
            positionHabitatFloor(this.floorObject, this.cameraObject, this.habitatDepthCm, this.habitatLateralCm);
        }
        this.demoControl.setStatus(`habitat ${this.habitatDepthCm}cm  offset ${this.habitatLateralCm}cm`);
    }

    /**
     * Starts the scripted story. Only meaningful when DEMO_AUTOPLAY_ON_START is
     * false — that combination is the staging workflow: spawn calm, frame the
     * shot with the placement keys, then press P to roll.
     *
     * Deliberately NOT a mid-run restart. Replaying in place would mean
     * reseeding the repository and rebinding the slots, and rebinding
     * re-registers the Interactable callbacks attached in attachInteraction —
     * every replay would stack another set of handlers on the same body and
     * fire selection twice. DemoSequence.start() is already idempotent, so
     * pressing P twice is harmless; to genuinely re-run the story, refresh
     * Preview (the partial-save reseed in onStart restores all three tasks).
     */
    private startSequence(): void {
        if (!this.sequence) return;
        this.sequence.start();
        console.log("[WednesdayStaging] story started manually");
    }

    private onStart(): void {
        this.clock = new DemoClock(0);
        this.repository = new TaskRepository(new PersistentTaskStorage(global.persistentStorageSystem.store, DEMO_STORAGE_KEY), this.clock);
        let tasks = this.repository.restore();
        // The scripted story resolves one task, which is then removed from
        // storage — so a restored save has only two open tasks and the demo
        // would replay short by one creature and with no story to tell. Reset
        // to a full fixture set whenever the save is incomplete, so every run
        // of the sequence starts from the same three-creature opening.
        // (Restore itself is still exercised: a save WITH all three intact is
        // restored normally rather than reseeded.)
        if (tasks.length > 0 && tasks.length < DEMO_TASK_FIXTURES.length) {
            console.log(`[WednesdayDemo] partial save (${tasks.length}/${DEMO_TASK_FIXTURES.length} open) — reseeding for the demo sequence`);
            global.persistentStorageSystem.store.remove(DEMO_STORAGE_KEY);
            this.repository = new TaskRepository(new PersistentTaskStorage(global.persistentStorageSystem.store, DEMO_STORAGE_KEY), this.clock);
            tasks = [];
        }
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
        this.cameraObject = this.findSceneObject("Camera Object");
        if (this.cameraObject) this.floorObject = buildHabitatFloor(this.cameraObject);
        else console.error("[WednesdayDemo] Camera Object not found — habitat floor not built.");
        this.demoControl = new DemoControlView(() => this.advanceDemoTime(), {
            onFurther: () => this.nudgeHabitat(HABITAT_DEPTH_STEP_CM, 0),
            onNearer: () => this.nudgeHabitat(-HABITAT_DEPTH_STEP_CM, 0),
            onLeft: () => this.nudgeHabitat(0, -HABITAT_LATERAL_STEP_CM),
            onRight: () => this.nudgeHabitat(0, HABITAT_LATERAL_STEP_CM),
            onRecenter: () => this.recenterHabitat(),
            onPlay: () => this.startSequence(),
        });
        this.demoControl.setStatus(`${tasks.length} tasks • all calm`);
        this.syncArbiter();

        this.sequence = new DemoSequence({
            onAdvanceTime: () => this.advanceDemoTime(),
            onBeginApproach: () => this.openApproachGate(),
            onSelect: () => this.scriptedSelect(),
            onResolveHoldStart: () => this.scriptedResolveStart(),
            onResolveHoldEnd: () => this.scriptedResolveEnd(),
            onBeat: (beat, elapsedS) => this.onDemoBeat(beat, elapsedS),
        });
        if (DEMO_AUTOPLAY_ON_START) {
            this.sequence.start();
        } else {
            // Staging mode: creatures spawn calm and stay calm until P. Frame
            // the shot with the placement keys first, then roll.
            this.demoControl.setStatus(`${tasks.length} tasks • staging — P to play`);
            console.log("[WednesdayStaging] autoplay off — arrows move habitat, C recenters, P plays the story");
        }

        console.log(`[WednesdayDemo] ready open=${tasks.length} hold=${RESOLVE_HOLD_DURATION_S}s chaser=none autoplay=${DEMO_AUTOPLAY_ON_START}`);
    }

    private onUpdate(): void {
        if (!this.interaction) return;
        const dt = getDeltaTime();
        // Sequence first: a beat fired this frame should take effect before
        // the gesture state machine and arbiter observe the world, so a
        // scripted press is processed on the same frame it is issued.
        if (this.sequence) this.sequence.update(dt);
        this.interaction.update(dt);
        this.syncArbiter();
    }

    // ── Scripted demo story ────────────────────────────────────────────────
    // Each of these drives the SAME public entry points a real user's gesture
    // would hit (CreatureInteractionState.pressStart/pressEnd), so the story
    // cannot show behavior the live interaction path wouldn't also produce.

    private openApproachGate(): void {
        if (this.approachGateOpen) return;
        this.approachGateOpen = true;
        const slot = this.slots.find((candidate) => candidate.taskId === this.activeChaserId);
        if (slot) slot.creature.requestChase();
        console.log(`[WednesdayEvidence] approach begins task=${this.activeChaserId ?? "none"}`);
    }

    /** Short pinch = SELECT (press then immediate release, per the gesture
     *  contract: role is frozen at press, so this can never resolve). */
    private scriptedSelect(): void {
        const taskId = this.activeChaserId;
        if (!taskId) return;
        this.interaction.pressStart(taskId);
        this.interaction.pressEnd();
    }

    private scriptedResolveStart(): void {
        const taskId = this.interaction.selectedId;
        if (!taskId) return;
        this.interaction.pressStart(taskId);
    }

    private scriptedResolveEnd(): void {
        this.interaction.pressEnd();
    }

    private onDemoBeat(beat: DemoBeat, elapsedS: number): void {
        const open = this.repository.listOpen().length;
        const status = beat === "CALM" ? `${open} tasks • all calm`
            : beat === "URGENT" ? "one needs attention"
            : beat === "APPROACH" ? "coming to you"
            : beat === "SELECT" ? "tap held • read it"
            : beat === "RESOLVE" ? "holding to let go"
            : `${open} tasks remaining`;
        this.demoControl.setStatus(status);
        console.log(`[WednesdayEvidence] beat=${beat} t=${elapsedS.toFixed(2)}s open=${open}`);
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
            // Identity color from the task's own persisted seed, so the same
            // task is always the same creature (see CreatureBehavior.setAppearanceSeed).
            creature.setAppearanceSeed(task.appearanceSeed);
            creature.setHabitatHome(
                HABITAT_HOME_GROUP_LATERAL_CM + (i - 1) * HABITAT_HOME_LATERAL_SPACING_CM,
                HABITAT_HOME_DEPTH_CM + (i === 1 ? HABITAT_HOME_SIDE_DEPTH_OFFSET_CM : 0),
                GROUND_Y_OFFSET_CM,
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
                // Selection happened here regardless; only the presentation
                // transition waits for the approach gate (see its field doc).
                if (slot.taskId === nextId) {
                    if (this.approachGateOpen) slot.creature.requestChase();
                } else {
                    slot.creature.endChase();
                }
            }
            console.log(`[WednesdayDemo] arbiter chaser=${nextId ?? "none"} approaching=${this.approachGateOpen}`);
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
            // While the approach gate is closed the selected chaser is still
            // presented as URGENT — restless, growing, facing the user — which
            // is exactly the beat before it starts closing distance.
            const presentingAsChaser = slot.taskId === nextId && this.approachGateOpen;
            slot.creature.setUrgent(this.stateEngine.deriveState(task, presentingAsChaser) === "URGENT");
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
        // Close the gate again so the next-most-urgent task (which is also
        // past the threshold in the demo fixture set) does not immediately
        // start approaching and step on the closing beat. It still presents
        // as URGENT — the remaining two read as "one restless, one settled".
        this.approachGateOpen = false;
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
