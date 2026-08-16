import { ART } from "../Config/ArtDirection";
import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";
import {
    HABITAT_HOME_GROUP_LATERAL_CM,
    HABITAT_HOME_SIDE_DEPTH_OFFSET_CM,
    HABITAT_HOME_WANDER_RADIUS_CM,
    RESOLVE_HOLD_DURATION_S,
    URGENCY_AGE_WINDOW_MS,
    DEMO_AUTOPLAY_ON_START,
    SHOW_ONBOARDING_ON_START,
    DEMO_SEED_TASK_COUNT,
    SHOW_DEMO_CONTROL_PANEL,
    HABITAT_DEPTH_STEP_CM,
    HABITAT_LATERAL_STEP_CM,
    HABITAT_DEPTH_MIN_CM,
    HABITAT_DEPTH_MAX_CM,
    HABITAT_LATERAL_LIMIT_CM,
    DEMO_TASK_COUNT,
    HABITAT_TWO_ROW_THRESHOLD,
    HABITAT_BACK_ROW_COUNT,
    VISUAL_HARNESS_FRAME,
    VISUAL_HARNESS_SETTLE_S,
    VISUAL_HARNESS_POST_RELEASE_SETTLE_S,
    RESOLVE_HOLD_DURATION_S as HOLD_S,
} from "../Config/CreatureConfig";
import { DemoClock } from "../Data/Clock";
import { PersistentTaskStorage } from "../Data/TaskStorage";
import { TaskRecord } from "../Data/TaskRecord";
import { TaskRepository } from "../Data/TaskRepository";
import { CreatureBehavior } from "../Creature/CreatureBehavior";
import { findChildByName } from "../Creature/CreatureMovement";
import { DEMO_TASK_FIXTURES, DemoInput } from "../Input/DemoInput";
import { KeyboardInput } from "../Input/KeyboardInput";
import { VoiceInput } from "../Input/VoiceInput";
import { AmbientHud } from "../UI/AmbientHud";
import { OnboardingFlow } from "../UI/OnboardingFlow";
import { CompletedEntry, EndOfDayView } from "../UI/EndOfDayView";
import { ClosingRitual } from "../UI/ClosingRitual";

/** Quiet loop for the attending state — see setFocusAudio. */
const focusTrack = requireAsset("../../GeneratedSFX/FocusAmbience.wav") as AudioTrackAsset;
import { ICON_COMPUTER, RetroDialog, skinCursorVisuals } from "../UI/RetroUi";
import { resolveAnchor, UI_ANCHORS } from "../UI/UiLayout";
import { COMPLETION, DAY_COMPLETE, HUD, RELEASE_TOASTS } from "../UI/UiCopy";
import { speciesForSeed } from "../Creature/CreaturePetVisual";
import { OrderedTaskIdentitySource, TaskCreationService } from "../Input/TaskCreationService";
import { AttentionArbiter } from "../State/AttentionArbiter";
import { StateEngine } from "../State/StateEngine";
import { TaskResolutionService } from "../State/TaskResolutionService";
import { CreatureInteractionState } from "./CreatureInteractionState";
import { DemoBeat, DemoSequence } from "./DemoSequence";
import { DemoControlView } from "./DemoControlView";
import { TaskSelectionView } from "./TaskSelectionView";
import { buildHabitatFloor, positionHabitatFloor } from "./HabitatFloor";
import { PerfGate } from "../Debug/PerfGateProbe";
import { SIK } from "SpectaclesInteractionKit.lspkg/SIK";
import { InteractorInputType } from "SpectaclesInteractionKit.lspkg/Core/Interactor/Interactor";

// v4: staggered creation times changed (see seedStaggeredDemoTasks) so a
// single "Advance Demo Time" press now produces one of each behavior state
// (CALM/URGENT/CHASING) instead of only CALM/CHASING — bump forces a reseed
// so a v3 demo save (different creation times) can't produce stale ages.
// v5: appearanceSeed semantics changed (OrderedTaskIdentitySource), and seeds
// are persisted — a v4 save would restore the old hash seeds and silently undo
// the species/colour spread. Bumping the key retires those saves instead.
// v6: DEMO_SEED_TASK_COUNT arrived. A v5 save holds six tasks, which restores
// straight over the new smaller seed and leaves no room under the six-task cap
// for anything the user types or speaks — the exact symptom the knob exists to
// fix. Retiring the old key makes the setting take effect on the next run
// instead of after a manual R.
const DEMO_STORAGE_KEY = "task-organism.wednesday-demo.v6.presentation";
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
/**
 * The designer-editable clone source. A disabled SceneObject in the scene, so
 * whatever a designer changes on it (mesh, material, child parts, the
 * CreatureBehavior inputs) is what every runtime-created slot 4-6 becomes.
 * Kept disabled so it never renders as a seventh creature.
 */
const CREATURE_TEMPLATE_NAME = "CreatureTemplate";
/** Frames to wait after a pinch before deciding it missed. Two is enough for
 *  SIK's update to have delivered onTriggerStart to a creature it did hit. */
const MISS_CHECK_DELAY_FRAMES = 2;

/**
 * The golden frames, in capture order. Each names a beat to jump to, an extra
 * hold-progress pump (for the mid-gesture frame, which is not on a beat
 * boundary), and how long to let eased channels settle before declaring READY.
 */
const VISUAL_HARNESS_FRAMES: {
    name: string;
    beat: DemoBeat;
    holdFraction: number;
    settleS: number;
}[] = [
    { name: "01-calm-habitat", beat: "CALM", holdFraction: 0, settleS: VISUAL_HARNESS_SETTLE_S },
    { name: "02-urgency", beat: "URGENT", holdFraction: 0, settleS: VISUAL_HARNESS_SETTLE_S },
    { name: "03-approach", beat: "APPROACH", holdFraction: 0, settleS: VISUAL_HARNESS_SETTLE_S },
    { name: "04-selection-panel", beat: "SELECT", holdFraction: 0, settleS: VISUAL_HARNESS_SETTLE_S },
    { name: "05-hold-50pct", beat: "RESOLVE", holdFraction: 0.5, settleS: VISUAL_HARNESS_SETTLE_S },
    // Release frames jump to RESOLVE and then pump the hold to 100%, rather
    // than jumping to the RELEASED beat. Completion is triggered by hold
    // progress reaching 1.0 — the same route a user's gesture takes — so
    // landing on the RELEASED beat with a frozen interaction produced a frame
    // where nothing had actually completed (open=6 where 5 was expected).
    { name: "06-release", beat: "RESOLVE", holdFraction: 1.0, settleS: VISUAL_HARNESS_SETTLE_S },
    { name: "07-post-release", beat: "RESOLVE", holdFraction: 1.0, settleS: VISUAL_HARNESS_POST_RELEASE_SETTLE_S },
];

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
    private voice!: VoiceInput;
    private demoControl!: DemoControlView;
    private slots: CreatureSlot[] = [];
    /** True while onboarding owns the stage — restored/live creatures stay
     *  hidden until the flow finishes (see setWorldVisible). */
    private worldHidden = false;
    private activeChaserId: string | null = null;
    private heldInteractionId: string | null = null;
    // ── Care-loop UI layer (placeholder pass, 2026-08-16 design brief) ──────
    private hud: AmbientHud | null = null;
    private onboarding: OnboardingFlow | null = null;
    private endOfDay: EndOfDayView | null = null;
    private ritual: ClosingRitual | null = null;
    /** Quiet bed that plays only while a creature is being attended. */
    private focusAudio: AudioComponent | null = null;
    private resolutionService!: TaskResolutionService;
    private creator!: TaskCreationService;
    /**
     * The task the user invited close with "Give this one attention".
     * PRESENTATION-ONLY override: the arbiter still selects its single chaser
     * at the data level (invariants 3/4 untouched); while attending, that
     * arbiter choice simply doesn't present, so at most ONE creature is ever
     * approaching — the attended one.
     */
    private attendingTaskId: string | null = null;
    /** What the attending layer last presented, so requestChase/endChase fire
     *  once per change instead of every frame (per-frame endChase would
     *  interrupt live holds). */
    private presentedAttendingId: string | null = null;
    /** Task text + species per id, kept for TODAY.TXT after the repository
     *  forgets completed tasks (storage invariant 8 caps them). */
    private taskInfoById = new Map<string, { text: string; seed: number }>();
    private completedToday: CompletedEntry[] = [];
    private completionCard: RetroDialog | null = null;
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
    private habitatDepthCm = ART.habitatDepthCm;
    private habitatLateralCm = HABITAT_HOME_GROUP_LATERAL_CM;
    private cameraObject: SceneObject | null = null;
    private floorObject: SceneObject | null = null;
    private cloneContainer: SceneObject | null = null;
    /** Visual-harness state: set when VISUAL_HARNESS_FRAME selects a frame. */
    private harnessSettleRemainingS = -1;
    // ── Gesture-harness state (see the gestureHarness* members below) ────────
    /** Latest hold progress, mirrored from onResolveProgress so a scenario can
     *  read it without subscribing. */
    private lastResolveProgress = 0;
    /** Number of completed releases this session. Counts the presentation
     *  event, which is what "one release effect" means to a test. */
    private releaseEventCount = 0;
    /** When true the scripted story stops advancing. Distinct from
     *  VISUAL_HARNESS_FRAME, which also freezes `interaction.update` — a
     *  gesture test needs beats held still but the gesture clock RUNNING, or a
     *  pinch-and-hold could never reach 100%. */
    private gestureHarnessPaused = false;
    /** Clock value before the story ran, so a restart can rewind to it. */
    private storyStartNowMs = 0;
    // ── Deselect-on-miss bookkeeping (playbook v3 §3.2) ──────────────────────
    /** Monotonic frame count; the three counters below are compared against it
     *  rather than against wall-clock time, because preview frame times here
     *  range from 60ms to 10s. */
    private frameCounter = 0;
    private pinchDownFrame = -1;
    private creaturePressFrame = -1;
    private uiPressFrame = -1;
    private missCheckAtFrame = -1;
    private harnessReported = false;

    // Rolling frame-time window for the capacity FPS measurement.
    private fpsAccumS = 0;
    private fpsFrames = 0;

    /**
     * Where slot `index` of `count` sits, as an offset from the habitat centre.
     *
     * <= HABITAT_TWO_ROW_THRESHOLD creatures keep the original single row at
     * ART.habitatSpacingCm, so the verified 3-creature demo is
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
                lateralCm: (index - (count - 1) / 2) * ART.habitatSpacingCm,
                depthCm: index === 1 ? HABITAT_HOME_SIDE_DEPTH_OFFSET_CM : 0,
            };
        }
        const backCount = Math.min(HABITAT_BACK_ROW_COUNT, count - 1);
        const frontCount = count - backCount;
        const spacing = ART.habitatCapacitySpacingCm;
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
            depthCm: ART.habitatRowDepthStepCm,
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
            // While the text keyboard is open every letter belongs to the task
            // being typed, not to a shortcut — otherwise "call THE dentist"
            // opens TODAY.TXT on each T and plays the story on the P.
            if (this.keyboard && this.keyboard.isOpen) return;
            if (event.key === Keys.K && this.keyboard) this.keyboard.show();
            // V is push-to-talk: one press listens, the first completed phrase
            // becomes a task, a second press cancels. Same creation path as K.
            if (event.key === Keys.V && this.voice) this.voice.toggle();
            if (event.key === Keys.R) {
                global.persistentStorageSystem.store.remove(DEMO_STORAGE_KEY);
                console.log("[WednesdayDemo] cleared demo storage; restart Preview to reseed");
            }
            // P plays the scripted story — the staging status line has always
            // promised this key, but the binding only existed as the staging
            // panel's Play button, which DEMO_CLIP_MODE hides. Bound for real
            // now that autoplay defaults off.
            if (event.key === Keys.P) this.startSequence();
            // O opens/closes the retro onboarding flow (design review + real
            // entry point once the world is gated behind it).
            if (event.key === Keys.O) this.toggleOnboarding();
            // T opens/closes TODAY.TXT — closing the day is the user's
            // gesture, never automatic.
            if (event.key === Keys.T && this.endOfDay) {
                this.closeOnboarding();
                // One window per anchor: a completion card still holding the
                // stage would interleave with TODAY.TXT into an unreadable
                // double-exposure (both dialogs share DialogAnchor).
                if (this.completionCard) {
                    this.completionCard.destroy();
                    this.completionCard = null;
                }
                this.endOfDay.toggle(this.completedToday);
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
                ART.groundYOffsetCm,
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
        // The story is about the habitat; an onboarding window left open would
        // sit in front of it (and stack with the completion card at the end).
        this.closeOnboarding();
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
        // A LEAF gesture run seeds the demo fixtures through the REAL repository
        // (gestureHarnessEnsureCreatures), so they persist into the same save
        // the designer's own habitat restores from. When the project is
        // configured to start empty, a restored set made entirely of fixture
        // text is that leftover — and because it fills all six slots, the next
        // task the user types is refused. Drop it instead.
        if (DEMO_SEED_TASK_COUNT === 0 && tasks.length > 0
            && tasks.every((task) => DEMO_TASK_FIXTURES.indexOf(task.text) >= 0)) {
            console.log(`[WednesdayDemo] cleared ${tasks.length} leftover fixture task(s) — starting empty`);
            global.persistentStorageSystem.store.remove(DEMO_STORAGE_KEY);
            this.repository = new TaskRepository(new PersistentTaskStorage(global.persistentStorageSystem.store, DEMO_STORAGE_KEY), this.clock);
            tasks = [];
        }
        if (tasks.length > 0) this.clock.setNowMs(this.latestCreationTime(tasks));

        const creator = new TaskCreationService(this.repository, this.clock, new OrderedTaskIdentitySource("demo", tasks.length));
        this.creator = creator;
        const demo = new DemoInput(creator);
        this.keyboard = new KeyboardInput(creator);
        this.voice = new VoiceInput(creator, {
            // Voice feedback belongs to the voice SCREEN, not to the ambient
            // notification slot — routing it there put onboarding chrome
            // ("listening…", "added: …") over the living habitat.
            onStatus: (text) => {
                if (this.demoControl) this.demoControl.setStatus(text);
                if (this.onboarding && this.onboarding.isOpen) this.onboarding.setVoiceStatus(text);
            },
        }, this);
        if (tasks.length === 0) tasks = this.seedStaggeredDemoTasks(demo);

        this.stateEngine = new StateEngine(this.clock);
        this.arbiter = new AttentionArbiter(this.stateEngine);
        const resolution = new TaskResolutionService(this.repository, (taskId) => this.releaseTask(taskId));
        this.resolutionService = resolution;
        this.interaction = new CreatureInteractionState(this.repository, resolution, {
            onSelectionChanged: (taskId) => this.onSelectionChanged(taskId),
            onResolveProgress: (progress) => this.onResolveProgress(progress),
        });

        this.bindCreatureSlots(tasks);
        // From here on, anything the creation service accepts (keyboard task,
        // voice task) must also become a visible creature. Set AFTER seeding
        // and the startup bind so fixtures never double-bind.
        creator.setOnCreated((task) => {
            this.bindLiveTask(task);
            if (this.onboarding) this.onboarding.notifyTaskAdded();
        });
        this.bindDeselectOnMiss();
        this.cameraObject = this.findSceneObject("Camera Object");
        this.ensureAudioListener();
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
        if (!SHOW_DEMO_CONTROL_PANEL) this.demoControl.setPanelVisible(false);
        this.demoControl.setStatus(`${tasks.length} tasks • all calm`);
        // The care-loop text layer: headline + notification slot, wandering
        // encouragements, and the end-of-day document (opened with T).
        this.hud = new AmbientHud();
        this.endOfDay = new EndOfDayView(this.cameraObject);
        this.ritual = new ClosingRitual(this.cameraObject);
        this.endOfDay.setRitualHandler(() => {
            this.closeOnboarding();
            if (this.ritual) this.ritual.start();
        });
        this.syncArbiter();

        // Captured before the story runs, so the gesture harness can put the
        // clock back where it started. See gestureHarnessRestartStory.
        this.storyStartNowMs = this.clock.nowMs();
        this.sequence = this.buildSequence();
        if (VISUAL_HARNESS_FRAME >= 0) {
            this.enterVisualHarness();
        } else if (DEMO_AUTOPLAY_ON_START) {
            this.sequence.start();
        } else {
            // Staging mode: creatures spawn calm and stay calm until P. Frame
            // the shot with the placement keys first, then roll.
            this.demoControl.setStatus(`${tasks.length} tasks • staging — P to play`);
            console.log("[WednesdayStaging] autoplay off — arrows move habitat, C recenters, P plays the story");
        }

        console.log(`[WednesdayDemo] ready open=${tasks.length} hold=${RESOLVE_HOLD_DURATION_S}s chaser=none autoplay=${DEMO_AUTOPLAY_ON_START}`);

        // SIK spawns its cursor visuals during its own start, so the retro
        // arrow is applied a beat later.
        const cursorSkin = this.createEvent("DelayedCallbackEvent") as DelayedCallbackEvent;
        cursorSkin.bind(() => console.log(`[RetroCursor] skinned ${skinCursorVisuals()} cursor(s)`));
        cursorSkin.reset(1.5);

        // The start screen: hill backdrop now, system message after its 2s
        // beat. LEAF gesture scenarios dismiss it when they arm (see
        // gestureHarnessJumpTo), so auto-show never obstructs the suite.
        if (SHOW_ONBOARDING_ON_START) this.toggleOnboarding();
    }

    /**
     * Jumps straight to one golden frame's state and freezes there.
     *
     * Autoplay is irrelevant here — the sequence is driven by advanceTo() in a
     * single call, so every beat up to the target fires in order, immediately.
     * Nothing about the resulting state depends on wall-clock timing, which is
     * the property that makes a golden image comparable across machines.
     *
     * The one exception is the mid-gesture frame: hold progress is accumulated
     * by CreatureInteractionState, so it is pumped explicitly by the exact
     * fraction wanted rather than waited out.
     */
    private enterVisualHarness(): void {
        const frame = VISUAL_HARNESS_FRAMES[VISUAL_HARNESS_FRAME];
        if (!frame) {
            console.error(`[VisualHarness] VISUAL_HARNESS_FRAME=${VISUAL_HARNESS_FRAME} is out of range (0..${VISUAL_HARNESS_FRAMES.length - 1})`);
            return;
        }
        this.sequence.start();
        this.sequence.advanceTo(this.sequence.timeOfBeat(frame.beat));
        if (frame.holdFraction > 0) this.interaction.update(HOLD_S * frame.holdFraction);
        this.harnessSettleRemainingS = frame.settleS;
        this.harnessReported = false;
        console.log(`[VisualHarness] frame=${frame.name} beat=${frame.beat} hold=${(frame.holdFraction * 100).toFixed(0)}% settling ${frame.settleS}s`);
    }

    /** Counts down the settle, then logs the frame's non-visual assertions.
     *  The capture is taken after READY appears. */
    private updateVisualHarness(dt: number): void {
        if (this.harnessSettleRemainingS < 0 || this.harnessReported) return;
        this.harnessSettleRemainingS -= dt;
        if (this.harnessSettleRemainingS > 0) return;
        this.harnessReported = true;
        const frame = VISUAL_HARNESS_FRAMES[VISUAL_HARNESS_FRAME];
        const open = this.repository.listOpen().length;
        let chasing = 0;
        let groundedOk = 0;
        let groundedBad = 0;
        let skipped = 0;
        const expected = (this.cameraObject ? this.cameraObject.getTransform().getWorldPosition().y : 0) + ART.groundYOffsetCm;
        for (const slot of this.slots) {
            // A released creature's root is torn down once the release effect
            // finishes, so touching it throws — which silently aborted this
            // whole assertion and meant the post-release frame never reported
            // READY at all. Skip dead and disabled slots rather than assuming
            // every slot outlives the frame.
            try {
                if (!slot.root || isNull(slot.root) || !slot.root.enabled) { skipped++; continue; }
                if (slot.creature.isChasing()) chasing++;
                const y = slot.root.getTransform().getWorldPosition().y;
                if (Math.abs(y - expected) <= 1.0) groundedOk++;
                else {
                    groundedBad++;
                    console.log(`[VisualHarness] GROUND FAIL ${slot.root.name} y=${y.toFixed(2)} expected=${expected.toFixed(2)}`);
                }
            } catch (e) {
                skipped++;
            }
        }
        const invariant = chasing <= 1 ? "ok" : "*** INVARIANT 4 VIOLATED ***";
        console.log(`[VisualHarness] frame=${frame.name} READY open=${open} chasing=${chasing} (${invariant}) groundedOk=${groundedOk} groundedBad=${groundedBad} skipped=${skipped}`);
    }

    private onUpdate(): void {
        if (!this.interaction) return;
        const dt = getDeltaTime();
        // Rides the existing update rather than owning one, so the probe costs
        // a single comparison per frame outside a release window.
        PerfGate.sample(dt);
        this.updateDeselectOnMiss();
        // Sequence first: a beat fired this frame should take effect before
        // the gesture state machine and arbiter observe the world, so a
        // scripted press is processed on the same frame it is issued.
        if (VISUAL_HARNESS_FRAME >= 0) {
            // Frozen: the sequence was already advanced by command. Only the
            // settle countdown runs, so the captured state cannot drift.
            this.updateVisualHarness(dt);
        } else if (this.sequence && !this.gestureHarnessPaused) {
            this.sequence.update(dt);
        }
        // Frozen while the visual harness holds a frame. Without this the
        // hold keeps accumulating through the settle window: the 50% frame ran
        // on to 100%, completed the task and captured a post-release image
        // instead. The assertion caught it (open=5 where 6 was expected) —
        // which is exactly the failure the non-visual checks exist for.
        if (VISUAL_HARNESS_FRAME < 0) this.interaction.update(dt);
        this.syncArbiter();
        if (this.voice) this.voice.update(dt);
        if (this.ritual) this.ritual.update(dt);
        if (this.hud) this.hud.update(dt);

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
        // While the user is attending a creature, the arbiter's pick waits at
        // home — the attended one is the single approacher (invariant 4).
        if (this.attendingTaskId) return;
        const slot = this.slots.find((candidate) => candidate.taskId === this.activeChaserId);
        if (slot) slot.creature.requestChase();
        if (slot && this.hud) this.hud.notify(HUD.chaserHeadline, HUD.chaserBody, 9);
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
        // DEMO_SEED_TASK_COUNT leaves room under the repository's 6-task cap
        // for tasks the user types or speaks — at 6 seeded, every add is refused.
        const count = Math.min(DEMO_SEED_TASK_COUNT, DEMO_TASK_COUNT, DEMO_TASK_FIXTURES.length, MAX_CREATURE_SLOTS);
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
    /**
     * Spatial audio attenuates against an AudioListenerComponent, and without
     * one every positional cue plays flat — the distance and direction work in
     * CreatureBehavior.spatialise would silently do nothing. Created on the
     * camera rather than required as authored, for the same reason the
     * per-creature AudioComponents are created: a missing optional component
     * should not mean silence with no diagnostic.
     */
    private ensureAudioListener(): void {
        if (!this.cameraObject) {
            console.error("[WednesdayDemo] no Camera Object — spatial audio has no listener, cues will play flat.");
            return;
        }
        const existing = this.cameraObject.getComponent("Component.AudioListenerComponent");
        if (existing) return;
        const listener = this.cameraObject.createComponent("Component.AudioListenerComponent");
        console.log(`[StateAudio] audio listener ${listener ? "created on Camera Object" : "FAILED to create"}`);
    }

    private resolveCreatureRoots(needed: number): SceneObject[] {
        const roots: SceneObject[] = [];
        for (const name of SLOT_NAMES) {
            const found = this.findSceneObject(name);
            if (found) roots.push(found);
        }
        // Clone from the AUTHORED template, not from whichever slot happens to
        // be last. The template is a real, disabled scene object a designer can
        // open and edit; the old behaviour cloned MovementRoot_3 purely because
        // it was the last one, which made the clone source an accident of
        // hierarchy order and invisible to anyone who did not read this method.
        //
        // It also removes a live trap: MovementRoot_1 carries the
        // TaskOrganismController as well as CreatureBehavior, so cloning "the
        // first slot" would have duplicated the composition root itself. The
        // template carries CreatureBehavior only.
        const template = this.findSceneObject(CREATURE_TEMPLATE_NAME) ?? roots[roots.length - 1];
        if (!this.findSceneObject(CREATURE_TEMPLATE_NAME)) {
            console.log(`[WednesdayDemo] no "${CREATURE_TEMPLATE_NAME}" in the scene — falling back to the last authored slot as the clone source.`);
        }
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
            // The template is authored DISABLED so it never renders as an extra
            // creature, and a copy inherits that. Every clone is a real slot,
            // so re-enable it explicitly rather than relying on the source's
            // enabled state — which a designer is free to toggle.
            clone.enabled = true;
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

            const view = new TaskSelectionView(
                visualRoot,
                this.selectionActionsFor(task.id, creature),
                () => { this.uiPressFrame = this.frameCounter; },
            );
            view.setTaskText(task.text);
            this.taskInfoById.set(task.id, { text: task.text, seed: task.appearanceSeed });
            // Identity color from the task's own persisted seed, so the same
            // task is always the same creature (see CreatureBehavior.setAppearanceSeed).
            creature.setAppearanceSeed(task.appearanceSeed);
            const layout = this.slotLayout(i, tasks.length);
            creature.setHabitatHome(
                this.habitatLateralCm + layout.lateralCm,
                this.habitatDepthCm + layout.depthCm,
                ART.groundYOffsetCm,
                HABITAT_HOME_WANDER_RADIUS_CM,
            );
            this.attachInteraction(body, task.id);
            this.slots.push({ taskId: task.id, root, creature, view });
            console.log(`[WednesdayEvidence] habitat task=${task.id} slot=${i + 1}/${tasks.length} lateral=${layout.lateralCm} depth=+${layout.depthCm}`);
        }
    }

    /**
     * Binds ONE task created after startup (keyboard, voice) to a creature.
     *
     * Startup binding covers seeded tasks only; before this method existed a
     * runtime-created task landed in the repository but never appeared in the
     * habitat. Slot reuse is deliberately avoided — a released slot's
     * Interactable handlers and Later closure capture the OLD taskId — so a
     * fresh root is cloned from the authored template instead. The repository's
     * MAX_OPEN_TASKS cap has already passed by the time this runs, so the live
     * creature count stays bounded.
     */
    private bindLiveTask(task: TaskRecord): void {
        const root = this.acquireFreeRoot();
        if (!root) {
            console.error(`[WednesdayDemo] no creature root available for live task ${task.id}`);
            return;
        }
        // A task typed DURING onboarding must not pop up behind the dialog —
        // it appears with the rest of the world when the flow finishes.
        root.enabled = !this.worldHidden;
        const creature = root.getComponent(CreatureBehavior.getTypeName()) as CreatureBehavior;
        const visualRoot = findChildByName(root, "VisualRoot");
        const body = visualRoot ? findChildByName(visualRoot, "Body") : null;
        if (!creature || !visualRoot || !body) {
            console.error(`[WednesdayDemo] incomplete live slot for task ${task.id}`);
            return;
        }
        const view = new TaskSelectionView(
            visualRoot,
            this.selectionActionsFor(task.id, creature),
            () => { this.uiPressFrame = this.frameCounter; },
        );
        view.setTaskText(task.text);
        this.taskInfoById.set(task.id, { text: task.text, seed: task.appearanceSeed });
        creature.setAppearanceSeed(task.appearanceSeed);
        const layout = this.slotLayout(this.slots.length, this.slots.length + 1);
        creature.setHabitatHome(
            this.habitatLateralCm + layout.lateralCm,
            this.habitatDepthCm + layout.depthCm,
            ART.groundYOffsetCm,
            HABITAT_HOME_WANDER_RADIUS_CM,
        );
        this.attachInteraction(body, task.id);
        this.slots.push({ taskId: task.id, root, creature, view });
        this.syncArbiter();
        console.log(`[WednesdayEvidence] live task bound task=${task.id} slots=${this.slots.length}`);
    }

    /** An authored slot not yet used by any binding, else a fresh template clone. */
    private acquireFreeRoot(): SceneObject | null {
        const used = new Set(this.slots.map((slot) => slot.root));
        for (const name of SLOT_NAMES) {
            const found = this.findSceneObject(name);
            if (found && !used.has(found)) return found;
        }
        const template = this.findSceneObject(CREATURE_TEMPLATE_NAME);
        if (!template) return null;
        if (!this.cloneContainer) this.cloneContainer = global.scene.createSceneObject("CreatureSlotClones");
        const clone = this.cloneContainer.copyWholeHierarchy(template);
        clone.name = `MovementRoot_live_${this.slots.length + 1}`;
        clone.enabled = true;
        return clone;
    }

    /* ══════════════════════════════════════════════════════════════════════
     * GESTURE HARNESS — read/controlled by the gate6 LEAF scenarios only.
     *
     * These exist because the gate6 scenarios test the REAL input path: a
     * pinch injected by PreviewInteractTool, resolved by SIK against the real
     * collider, arriving at the real Interactable. That path cannot be driven
     * from inside the Lens, so a scenario has to (a) put the story in a known
     * state, (b) hand the agent the object to pinch, and (c) read back what
     * happened. Nothing here is used by the demo itself.
     * ══════════════════════════════════════════════════════════════════════ */

    /**
     * Fills an empty habitat with the demo fixtures, staggered exactly as
     * startup seeding would have. Creation runs through the normal
     * TaskCreationService, so `onCreated` binds each creature for us.
     */
    gestureHarnessEnsureCreatures(): void {
        if (this.slots.length > 0 || !this.creator) return;
        const restoreNowMs = this.clock.nowMs();
        const count = Math.min(DEMO_TASK_COUNT, DEMO_TASK_FIXTURES.length, MAX_CREATURE_SLOTS);
        for (let i = 0; i < count; i++) {
            this.clock.setNowMs(URGENCY_AGE_WINDOW_MS * DEMO_TASK_AGE_FRACTIONS[i]);
            this.creator.create(DEMO_TASK_FIXTURES[i]);
        }
        this.clock.setNowMs(restoreNowMs);
        this.storyStartNowMs = this.clock.nowMs();
        this.sequence = this.buildSequence();
        this.syncArbiter();
        console.log(`[WednesdayDemo] harness seeded ${this.slots.length} creatures (design seed is ${DEMO_SEED_TASK_COUNT})`);
    }

    /**
     * Jumps the story to a named beat in one call and holds it there, so a
     * gesture fires against a known state rather than whatever the wall clock
     * happened to reach. Same beat-jump the golden-image harness relies on.
     */
    gestureHarnessJumpTo(beat: DemoBeat, pause: boolean): void {
        if (!this.sequence) return;
        // A test is taking over: the onboarding overlay (auto-shown on start
        // for design review) would sit between the camera and every creature,
        // and SIK would reject the scenario's pinches as obstructed. Closed
        // BEFORE seeding, and via closeOnboarding — a bare dismiss() leaves
        // the world-gating active, so every seeded creature would spawn with
        // its root disabled and no pinch could ever land (that was exactly
        // the gate6 timeout after world-gating shipped).
        this.closeOnboarding();
        // DEMO_SEED_TASK_COUNT is a DESIGN setting and is normally 0, so the
        // habitat a designer sees contains only their own tasks. The gesture
        // scenarios still need creatures to pinch, so they seed their own here
        // rather than depending on that number.
        this.gestureHarnessEnsureCreatures();
        // Pause FIRST. Everything below reads the story's position, and on a
        // slow preview autoplay can advance between the read and the jump.
        this.gestureHarnessPaused = true;
        // DemoSequence cannot rewind, so reaching a beat that has already
        // passed means restarting. See gestureHarnessRestartStory for why this
        // is not an exotic case.
        if (this.sequence.timeOfBeat(beat) < this.sequence.elapsed) this.gestureHarnessRestartStory();
        this.sequence.advanceTo(this.sequence.timeOfBeat(beat));
        this.gestureHarnessPaused = pause;
        this.syncArbiter();
    }

    /**
     * Puts the scripted story back to its opening state.
     *
     * WHY A TEST NEEDS THIS
     * ---------------------
     * The LEAF plugin resets the Lens before each scenario, so the story starts
     * at CALM — but the scenario BODY does not run until the preview has booted
     * and the plugin has handed over, and autoplay is running the whole time.
     * On a loaded machine that gap has been observed at 2.5 minutes, by which
     * point the story had reached URGENT and a scenario arming at CALM could
     * only refuse. The race is invisible when the preview is fast and certain
     * when it is not, which is the worst combination for a test suite.
     *
     * Rewinding removes the dependency on how quickly the preview boots.
     *
     * Undoes exactly what the beats mutate: the demo clock jump, the approach
     * gate, and any selection. It deliberately does NOT resurrect completed
     * tasks — a resolve is a real repository write, and pretending otherwise
     * would make a test that quietly disagrees with storage.
     */
    gestureHarnessRestartStory(): void {
        this.clock.setNowMs(this.storyStartNowMs);
        this.demoAdvanced = false;
        this.approachGateOpen = false;
        this.activeChaserId = null;
        if (this.interaction) this.interaction.deselect();
        this.sequence = this.buildSequence();
        this.sequence.start();
        this.syncArbiter();
        console.log("[WednesdayDemo] gesture harness restarted the story at CALM");
    }

    /** Lets the story run again. The moving-chaser scenarios need it running. */
    gestureHarnessResume(): void {
        this.gestureHarnessPaused = false;
    }

    /** Stops the story where it stands, without moving to a beat. Used to
     *  settle the world before assertions so a failure does not leave the
     *  sequence running on into whatever executes next. */
    gestureHarnessPause(): void {
        this.gestureHarnessPaused = true;
    }

    /**
     * Everything a gesture scenario asserts on, in one read. Returned as plain
     * data so a scenario can snapshot it before a gesture and diff after.
     */
    gestureHarnessSnapshot(): {
        beat: string;
        selectedId: string | null;
        openCount: number;
        releaseCount: number;
        holdProgress: number;
        chaserId: string | null;
        slots: { taskId: string; objectName: string; worldPosition: vec3; isChaser: boolean }[];
    } {
        return {
            beat: this.sequence ? this.sequence.beat : "NONE",
            selectedId: this.interaction ? this.interaction.selectedId : null,
            openCount: this.repository ? this.repository.listOpen().length : -1,
            releaseCount: this.releaseEventCount,
            holdProgress: this.lastResolveProgress,
            chaserId: this.activeChaserId,
            slots: this.slots.map((s) => ({
                taskId: s.taskId,
                // The Body child is what carries the collider and Interactable,
                // so it is the object the agent must target — not the root.
                objectName: this.interactionBodyOf(s.root) ? this.interactionBodyOf(s.root)!.name : "(no body)",
                worldPosition: this.interactionBodyOf(s.root)
                    ? this.interactionBodyOf(s.root)!.getTransform().getWorldPosition()
                    : s.root.getTransform().getWorldPosition(),
                isChaser: s.taskId === this.activeChaserId,
            })),
        };
    }

    /**
     * The live Interactable for a task, so a scenario can drive a real SIK
     * pinch at it. Returning the component rather than a name keeps the test
     * pointed at the same object the runtime wired up in attachInteraction.
     */
    gestureHarnessInteractableOf(taskId: string): Interactable | null {
        const slot = this.slots.find((s) => s.taskId === taskId);
        if (!slot) return null;
        const body = this.interactionBodyOf(slot.root);
        return body ? (body.getComponent(Interactable.getTypeName()) as Interactable) : null;
    }

    /** Finds the descendant carrying the Interactable for a creature root. */
    private interactionBodyOf(root: SceneObject): SceneObject | null {
        let found: SceneObject | null = null;
        const visit = (obj: SceneObject): void => {
            if (found) return;
            if (obj.getComponent(Interactable.getTypeName())) {
                found = obj;
                return;
            }
            for (let i = 0; i < obj.getChildrenCount(); i++) visit(obj.getChild(i));
        };
        visit(root);
        return found;
    }

    /** The scripted story's hook set, in one place so the gesture harness can
     *  rebuild an identical sequence when it rewinds. */
    private buildSequence(): DemoSequence {
        return new DemoSequence({
            onAdvanceTime: () => this.advanceDemoTime(),
            onBeginApproach: () => this.openApproachGate(),
            onSelect: () => this.scriptedSelect(),
            onResolveHoldStart: () => this.scriptedResolveStart(),
            onResolveHoldEnd: () => this.scriptedResolveEnd(),
            onBeat: (beat, elapsedS) => this.onDemoBeat(beat, elapsedS),
        });
    }

    /**
     * Playbook v3 §3.2: "tapping elsewhere deselects".
     *
     * WHY THIS LISTENS TO THE INTERACTOR RATHER THAN ADDING A BACKDROP
     * ---------------------------------------------------------------
     * The obvious implementation is a big invisible collider behind the
     * habitat to catch stray pinches. That is exactly the shape of a defect
     * this project has already had: a BackPlate whose collider sat in front of
     * the rows above it and swallowed their pinches. A backdrop large enough to
     * catch every miss is large enough to steal hits from the creatures.
     *
     * WHY IT LISTENS TO THE HAND AND NOT TO THE INTERACTOR
     * ----------------------------------------------------
     * `Interactor.onTriggerStart` carries `Interactable | null` and looks like
     * the obvious hook, but SIK never fires it with null: `processTriggerEvents`
     * only raises a Select trigger once something is targeted, so a pinch into
     * empty space produces no interactor event at all. Verified directly — a
     * pinch on a creature logged `onTriggerStart target=Body`, and a free-space
     * pinch logged nothing.
     *
     * So the signal has to come from the hand itself, which pinches regardless
     * of what is under it. A pinch is a miss when it did not begin a press on
     * any creature — determined by comparing frame counters rather than by
     * asking SIK what it hit, which keeps this independent of targeting.
     *
     * The check is deferred a couple of frames because the creature's
     * Interactable fires on SIK's own update, which may land after the pinch
     * event. Preview here runs as low as 0.1 fps, so this counts frames rather
     * than milliseconds.
     *
     * Bound in onStart, not onAwake: SIK builds its hand providers during the
     * ScriptComponent boot cycle, and subscribing earlier finds nothing.
     */
    private bindDeselectOnMiss(): void {
        const hands = [SIK.HandInputData.getHand("right"), SIK.HandInputData.getHand("left")];
        let bound = 0;
        for (const hand of hands) {
            if (!hand) continue;
            hand.onPinchDown.add(() => {
                this.pinchDownFrame = this.frameCounter;
                this.missCheckAtFrame = this.frameCounter + MISS_CHECK_DELAY_FRAMES;
            });
            bound++;
        }
        if (bound === 0) {
            console.error("[WednesdayDemo] no SIK hands — deselect-on-miss not bound");
            return;
        }
        console.log(`[WednesdayDemo] deselect-on-miss bound to ${bound} hand(s)`);
    }

    /** Runs the deferred miss check. Called once per frame from onUpdate. */
    private updateDeselectOnMiss(): void {
        this.frameCounter++;
        if (this.missCheckAtFrame < 0 || this.frameCounter < this.missCheckAtFrame) return;
        this.missCheckAtFrame = -1;
        // A creature press OR a UI press (Later button, open panel) that
        // started at or after the pinch means the pinch found something.
        // Anything else is "elsewhere".
        if (this.creaturePressFrame >= this.pinchDownFrame) return;
        if (this.uiPressFrame >= this.pinchDownFrame) return;
        if (this.interaction && this.interaction.deselect()) {
            console.log("[WednesdayEvidence] deselected — pinch landed on no creature");
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
        interactable.onTriggerStart.add(() => {
            // Stamped so the deferred miss check can tell a pinch that found a
            // creature from one that found nothing.
            this.creaturePressFrame = this.frameCounter;
            this.interaction.pressStart(taskId);
        });
        // Pass the creature's identity so a release reported by a NEIGHBOURING
        // creature (second hand brushing another collider) cannot cancel the
        // hold in flight on this one.
        interactable.onTriggerEnd.add(() => this.interaction.pressEnd(taskId));
        interactable.onTriggerEndOutside.add(() => this.interaction.pressEnd(taskId));
        interactable.onTriggerCanceled.add(() => this.interaction.pressEnd(taskId));
    }

    /** The three panel actions, shared by authored slots and live-bound tasks. */
    private selectionActionsFor(taskId: string, creature: CreatureBehavior) {
        return {
            onLater: () => {
                if (this.interaction.selectedId === taskId && this.interaction.later()) {
                    if (this.attendingTaskId === taskId) this.clearAttending();
                    creature.endChase();
                    // Acknowledge the deferral audibly. Fired here, after the
                    // repository write succeeded, so the sound never claims a
                    // snooze that did not happen.
                    creature.playSnoozeCue();
                    this.demoControl.setStatus(`${this.repository.listOpen().length} tasks • deferred`);
                }
            },
            onAttend: () => this.inviteAttention(taskId),
        };
    }

    /**
     * "Give this one attention" — the creature comes and stays close while
     * the user works. Presentation-only: syncArbiter presents the attended
     * creature as the single approacher and holds everyone else home, so
     * invariant 4 (at most ONE approaching creature) survives by construction.
     */
    private inviteAttention(taskId: string): void {
        const info = this.taskInfoById.get(taskId);
        this.attendingTaskId = taskId;
        this.interaction.deselect();
        if (this.hud) this.hud.setAttending(info ? info.text : null);
        this.setFocusAudio(true);
        console.log(`[CareLoop] attending task=${taskId}`);
        this.syncArbiter();
    }

    private clearAttending(): void {
        this.attendingTaskId = null;
        if (this.hud) this.hud.setAttending(null);
        this.setFocusAudio(false);
    }

    /**
     * The focus bed. Deliberately quiet and loop-only: it exists to make
     * sitting with one task easier, so it must never become something the
     * user notices as music.
     */
    private setFocusAudio(on: boolean): void {
        if (on) {
            if (this.focusAudio) return;
            const host = this.cameraObject ?? global.scene.createSceneObject("FocusAudio");
            const audio = host.createComponent("Component.AudioComponent") as AudioComponent;
            audio.audioTrack = focusTrack;
            audio.volume = 0.35;
            audio.play(-1);
            this.focusAudio = audio;
        } else if (this.focusAudio) {
            this.focusAudio.stop(true);
            this.focusAudio = null;
        }
    }

    /**
     * Closes the onboarding overlay and lets the ambient layer speak. Any
     * screen that takes over the view (the story, TODAY.TXT, the ritual) calls
     * this first — two stacked windows read as a glitch.
     */
    private closeOnboarding(): void {
        if (!this.onboarding || !this.onboarding.isOpen) return;
        this.onboarding.dismiss();
        this.setWorldVisible(true);
        if (this.hud) this.hud.setVisible(true);
    }

    /**
     * Drops the most recently added task and its creature while the user is
     * still writing the list. A discard, not a completion — no release effect
     * and nothing recorded for TODAY.TXT.
     */
    private removeLastTask(): boolean {
        if (this.slots.length === 0) return false;
        const slot = this.slots[this.slots.length - 1];
        if (!this.repository.discard(slot.taskId)) return false;
        if (this.interaction.selectedId === slot.taskId) this.interaction.deselect();
        if (this.attendingTaskId === slot.taskId) this.clearAttending();
        // The root goes back in the pool: acquireFreeRoot looks for roots that
        // no slot is using, so simply dropping the entry frees it for reuse.
        slot.root.enabled = false;
        this.slots.pop();
        this.taskInfoById.delete(slot.taskId);
        this.syncArbiter();
        console.log(`[CareLoop] discarded task=${slot.taskId} slots=${this.slots.length}`);
        return true;
    }

    /**
     * ADD TODAY'S TASKS means TODAY's: the moment the user commits to
     * entering a fresh list (the intro's buttons), whatever a previous
     * session left in storage is discarded — repository, creatures, and the
     * TODAY.TXT ledger. Restore-across-restart still works (invariant); it
     * just yields to an explicit fresh start.
     */
    private startFreshDay(): void {
        let guard = this.slots.length;
        while (guard-- > 0 && this.removeLastTask()) { /* slot-by-slot discard */ }
        this.completedToday = [];
        console.log("[CareLoop] fresh day — previous session's tasks cleared");
    }

    private toggleOnboarding(): void {
        if (this.onboarding && this.onboarding.isOpen) {
            this.onboarding.dismiss();
            // Closed without finishing (O toggle) — the world comes back.
            this.setWorldVisible(true);
            return;
        }
        this.onboarding = new OnboardingFlow(this, this.cameraObject, {
            openKeyboard: () => { if (this.keyboard) this.keyboard.show(); },
            removeLastTask: () => this.removeLastTask(),
            startFreshDay: () => this.startFreshDay(),
            startVoice: () => { if (this.voice && !this.voice.isListening) this.voice.start(); },
            listTasks: () => this.repository.listOpen().map((task) => task.text),
            status: (text) => this.demoControl.setStatus(text),
            onFinished: () => {
                // The world is on stage now — creatures appear and the
                // ambient layer may speak.
                this.setWorldVisible(true);
                if (this.hud) this.hud.setVisible(true);
                    const open = this.repository.listOpen().length;
                this.demoControl.setStatus(`${open} ${open === 1 ? "creature" : "creatures"} • here with you`);
            },
        });
        this.onboarding.show();
        // Onboarding owns the stage: restored tasks (persistence works across
        // restarts by design) wait hidden rather than standing behind the
        // welcome dialog — the world-gating pass the flow always promised.
        this.setWorldVisible(false);
    }

    /** Hides/shows every creature slot root. Roots, not creatures: a released
     *  creature's own disabled sceneObject survives the round trip untouched. */
    private setWorldVisible(visible: boolean): void {
        this.worldHidden = !visible;
        for (const slot of this.slots) slot.root.enabled = visible;
    }

    /**
     * The completion beat: card first, farewell toast on [Let it go]. The
     * repository was already saved before this runs (invariant 5).
     *
     * When this was the LAST open task the card becomes the end-of-day one,
     * and its button opens TODAY.TXT — so finishing everything is an event
     * rather than an empty habitat and silence.
     */
    private showCompletionCard(taskText: string, lastOne: boolean): void {
        if (this.completionCard) this.completionCard.destroy();
        const anchor = resolveAnchor(this.cameraObject, UI_ANCHORS.dialog);
        const copy = lastOne ? DAY_COMPLETE : COMPLETION;
        console.log(`[CareLoop] completion card lastOne=${lastOne} task="${taskText}" headline="${copy.headline}"`);
        // The task text is NOT repeated on the card — the user just released
        // that creature and knows what it was; naming it again read as noise.
        this.completionCard = new RetroDialog(anchor, {
            name: "Completion",
            title: copy.title,
            headline: copy.headline,
            body: copy.body,
            bodyHeightCm: lastOne ? 12 : 4,
            // Narrower than the onboarding windows: these cards carry one short
            // message and a single action — the ordinary one smaller still.
            widthCm: lastOne ? 52 : 46,
            buttonWidthCm: 24,
            icon: ICON_COMPUTER,
            onClose: () => {
                if (this.completionCard) this.completionCard.destroy();
                this.completionCard = null;
            },
            buttons: [{
                label: copy.button,
                action: () => {
                    if (this.completionCard) this.completionCard.destroy();
                    this.completionCard = null;
                    if (this.hud) {
                        const toast = RELEASE_TOASTS[this.releaseEventCount % RELEASE_TOASTS.length];
                        this.hud.toast(toast, 6);
                    }
                    // The day is over — this press is the "open TODAY.TXT"
                    // gesture, so the document is never forced on the user.
                    if (lastOne && this.endOfDay) this.endOfDay.open(this.completedToday);
                },
            }].concat(lastOne ? [{
                // The day is only over if the user says so — they may have
                // remembered something.
                label: DAY_COMPLETE.addMoreButton,
                action: () => {
                    if (this.completionCard) this.completionCard.destroy();
                    this.completionCard = null;
                    if (this.keyboard) this.keyboard.show();
                },
            }] : []),
        });
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
                // While attending, the arbiter choice stays data-only: the
                // attended creature owns the approach, and the endChase sweep
                // must not send it home.
                if (slot.taskId === nextId) {
                    if (this.approachGateOpen && !this.attendingTaskId) {
                        slot.creature.requestChase();
                        if (this.hud) this.hud.notify(HUD.chaserHeadline, HUD.chaserBody, 9);
                    }
                } else if (slot.taskId !== this.attendingTaskId) {
                    slot.creature.endChase();
                }
            }
            console.log(`[WednesdayDemo] arbiter chaser=${nextId ?? "none"} approaching=${this.approachGateOpen}`);
        }

        // ── Attending presentation (change-tracked, so holds are never
        // interrupted by per-frame endChase sweeps) ──────────────────────────
        if (this.attendingTaskId && !openTasks.some((task) => task.id === this.attendingTaskId)) {
            this.clearAttending();
        }
        if (this.attendingTaskId !== this.presentedAttendingId) {
            this.presentedAttendingId = this.attendingTaskId;
            if (this.attendingTaskId) {
                for (const slot of this.slots) {
                    if (slot.taskId === this.attendingTaskId) {
                        slot.creature.requestChase();
                    } else if (slot.taskId === this.activeChaserId) {
                        // The arbiter's chaser yields the floor while the user
                        // attends — one approacher at a time, always.
                        slot.creature.endChase();
                    }
                }
            }
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
            // Switching selection must first let the previously held creature
            // go, or it stays frozen in INTERACTING (its release only ran in
            // the null branch, which a direct A->B switch never visits).
            if (this.heldInteractionId && this.heldInteractionId !== taskId) {
                const previous = this.slots.find((candidate) => candidate.taskId === this.heldInteractionId);
                if (previous) previous.creature.endChase();
                this.heldInteractionId = null;
            }
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
        this.lastResolveProgress = progress;
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
        // Marked after release() so the window covers the frames that carry the
        // effect's cost. Counts live slots, not open tasks — the perf number is
        // about how many creatures are on screen.
        PerfGate.markRelease(this.slots.length);
        this.releaseEventCount += 1;
        console.log(`[WednesdayEvidence] release requested task=${taskId} remaining=${remaining}`);
        // The care-loop beat: remember the day's release for TODAY.TXT, close
        // any attending, and show the farewell card. All of it AFTER the
        // repository write above (invariant 5).
        const info = this.taskInfoById.get(taskId);
        if (info) this.completedToday.push({ text: info.text, species: speciesForSeed(info.seed) });
        if (this.attendingTaskId === taskId) this.clearAttending();
        // Nothing is left to carry: quiet the ambient layer so the closing
        // card and TODAY.TXT are the only things on screen.
        if (remaining === 0) {
            if (this.hud) this.hud.setVisible(false);
        }
        this.showCompletionCard(info ? info.text : "", remaining === 0);
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
