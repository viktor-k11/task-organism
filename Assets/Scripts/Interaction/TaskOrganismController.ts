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
    DEMO_TASK_COUNT,
    HABITAT_TWO_ROW_THRESHOLD,
    HABITAT_BACK_ROW_COUNT,
    HABITAT_CAPACITY_SPACING_CM,
    HABITAT_ROW_DEPTH_STEP_CM,
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
 * Creation ages as fractions of URGENCY_AGE_WINDOW_MS, oldest first. After
 * advancing to DEMO_ADVANCE_TARGET_MS (1.8W) each task's age is
 * 1.8W - createdAt, so these fractions produce a deliberate spread across the
 * CHASE_THRESHOLD (1.0):
 *   idx 0: age 1.80W -> URGENT, highest urgency -> the single chaser
 *   idx 1: age 1.40W -> URGENT (restless, stays in habitat)
 *   idx 2: age 1.10W -> URGENT (restless)
 *   idx 3: age 0.90W -> CALM
 *   idx 4: age 0.70W -> CALM
 *   idx 5: age 0.50W -> CALM
 * At capacity that is 1 chasing + 2 restless + 3 calm — the calm/restless
 * contrast stays legible instead of everything going urgent at once.
 */
const DEMO_TASK_AGE_FRACTIONS = [0, 0.4, 0.7, 0.9, 1.1, 1.3];
const DEMO_ADVANCE_TARGET_MS = URGENCY_AGE_WINDOW_MS * 1.8;
const MAX_CREATURE_SLOTS = 6;
const SLOT_NAMES = Array.from({ length: MAX_CREATURE_SLOTS }, (_, i) => `MovementRoot_${i + 1}`);

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
    private cloneContainer: SceneObject | null = null;

    // Rolling frame-time window for the capacity FPS measurement.
    private fpsAccumS = 0;
    private fpsFrames = 0;

    /**
     * Where slot `index` of `count` sits, as an offset from the habitat centre.
     *
     * <= HABITAT_TWO_ROW_THRESHOLD creatures keep the original single row at
     * HABITAT_HOME_LATERAL_SPACING_CM, so the verified 3-creature demo is
     * bit-for-bit unchanged. Above it, the habitat splits into two rows: a
     * back row of HABITAT_BACK_ROW_COUNT and a front row of the remainder,
     * each centred on its own row and the back row offset by half a spacing so
     * it interleaves into the front row's gaps rather than hiding behind it.
     *
     * Why two rows at all: the additive render region ends near +/-70cm
     * lateral at habitat depth, and a creature needs
     * |lateral| + urgent roam (16) + half body width (~7) inside that. Six in
     * one row does not fit without either overlapping bodies or pushing the
     * habitat far enough away to cost face readability.
     */
    private slotLayout(index: number, count: number): { lateralCm: number; depthCm: number } {
        if (count <= HABITAT_TWO_ROW_THRESHOLD) {
            return {
                lateralCm: (index - (count - 1) / 2) * HABITAT_HOME_LATERAL_SPACING_CM,
                depthCm: index === 1 ? HABITAT_HOME_SIDE_DEPTH_OFFSET_CM : 0,
            };
        }
        const backCount = Math.min(HABITAT_BACK_ROW_COUNT, count - 1);
        const frontCount = count - backCount;
        const spacing = HABITAT_CAPACITY_SPACING_CM;
        if (index < frontCount) {
            return { lateralCm: (index - (frontCount - 1) / 2) * spacing, depthCm: 0 };
        }
        // Back row is centred over the SAME span as the front row, divided by
        // its own count. A fixed half-spacing offset (the obvious way to
        // interleave) breaks centring whenever the back count is even — it put
        // 6 creatures at back 0/+30 instead of -22.5/+22.5, leaning the whole
        // group right. This lands the back row squarely in the front row's
        // gaps for 4, 5 and 6 while staying symmetric about the habitat axis.
        const j = index - frontCount;
        const frontSpan = (frontCount - 1) * spacing;
        const backSpacing = backCount > 0 ? frontSpan / backCount : 0;
        return {
            lateralCm: (j - (backCount - 1) / 2) * backSpacing,
            depthCm: HABITAT_ROW_DEPTH_STEP_CM,
        };
    }

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
            const layout = this.slotLayout(i, this.slots.length);
            this.slots[i].creature.setHabitatHome(
                this.habitatLateralCm + layout.lateralCm,
                this.habitatDepthCm + layout.depthCm,
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

        // Capacity instrumentation: rolling FPS plus a live assertion that
        // invariant 4 (at most ONE chaser) still holds with a full habitat.
        this.fpsAccumS += dt;
        this.fpsFrames++;
        if (this.fpsAccumS >= 3) {
            let chasing = 0;
            for (const slot of this.slots) if (slot.creature.isChasing()) chasing++;
            const fps = this.fpsFrames / this.fpsAccumS;
            console.log(`[Capacity] creatures=${this.slots.length} fps=${fps.toFixed(1)} chasing=${chasing}`
                + (chasing > 1 ? "  *** INVARIANT 4 VIOLATED ***" : ""));
            this.fpsAccumS = 0;
            this.fpsFrames = 0;
        }
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
        const count = Math.min(DEMO_TASK_COUNT, DEMO_TASK_FIXTURES.length, MAX_CREATURE_SLOTS);
        for (let i = 0; i < count; i++) {
            this.clock.setNowMs(URGENCY_AGE_WINDOW_MS * DEMO_TASK_AGE_FRACTIONS[i]);
            const task = demo.submit(DEMO_TASK_FIXTURES[i]);
            if (task) created.push(task);
        }
        return created;
    }

    /**
     * Returns `needed` creature roots, cloning the last authored one when the
     * scene has fewer. The scene authors only 3 slots; capacity is 6. Cloning
     * at runtime via copyWholeHierarchy keeps the authored scene file
     * untouched (no .scene diff, nothing to merge) and guarantees the clones
     * carry an identical VisualRoot/Body/ParticleAnchor hierarchy and
     * CreatureBehavior component, so no slot can drift from the verified one.
     */
    private resolveCreatureRoots(needed: number): SceneObject[] {
        const roots: SceneObject[] = [];
        for (const name of SLOT_NAMES) {
            const found = this.findSceneObject(name);
            if (found) roots.push(found);
        }
        const template = roots[roots.length - 1];
        // copyWholeHierarchy is a SceneObject method and parents the copy under
        // the receiver, so clones go under one identity-transform container at
        // the origin. Creatures are positioned with setWorldPosition, so the
        // container must not carry any transform of its own.
        if (roots.length < needed && template && !this.cloneContainer) {
            this.cloneContainer = global.scene.createSceneObject("CreatureSlotClones");
        }
        while (roots.length < needed && template && this.cloneContainer) {
            const clone = this.cloneContainer.copyWholeHierarchy(template);
            clone.name = `MovementRoot_${roots.length + 1}`;
            roots.push(clone);
            console.log(`[WednesdayDemo] cloned creature slot ${clone.name} (scene authored ${SLOT_NAMES.length - (needed - roots.length + 1) + 1})`);
        }
        return roots;
    }

    private bindCreatureSlots(tasks: TaskRecord[]): void {
        const roots = this.resolveCreatureRoots(tasks.length);
        if (roots.length < tasks.length) {
            console.error(`[WednesdayDemo] need ${tasks.length} creature roots, have ${roots.length}`);
            return;
        }
        // Any slot beyond the task count stays off.
        for (let i = tasks.length; i < roots.length; i++) roots[i].enabled = false;

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
            const layout = this.slotLayout(i, tasks.length);
            creature.setHabitatHome(
                this.habitatLateralCm + layout.lateralCm,
                this.habitatDepthCm + layout.depthCm,
                GROUND_Y_OFFSET_CM,
                HABITAT_HOME_WANDER_RADIUS_CM,
            );
            this.attachInteraction(body, task.id);
            this.slots.push({ taskId: task.id, root, creature, view });
            console.log(`[WednesdayEvidence] habitat task=${task.id} slot=${i + 1}/${tasks.length} lateral=${layout.lateralCm} depth=+${layout.depthCm}`);
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
