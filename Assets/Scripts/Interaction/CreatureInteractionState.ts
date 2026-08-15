import { LATER_SNOOZE_DURATION_MS, RESOLVE_HOLD_DURATION_S } from "../Config/CreatureConfig";
import { TaskRepository } from "../Data/TaskRepository";
import { TaskResolutionService } from "../State/TaskResolutionService";

type GestureRole = "select" | "resolve";

export interface CreatureInteractionHooks {
    onSelectionChanged(taskId: string | null): void;
    onResolveProgress(progress01: number): void;
}

/** Pure gesture state machine shared by SIK runtime input and LEAF tests. */
export class CreatureInteractionState {
    private selectedTaskId: string | null = null;
    private activeTaskId: string | null = null;
    private role: GestureRole | null = null;
    private elapsedS = 0;
    private completedThisGesture = false;

    constructor(
        private repository: TaskRepository,
        private resolution: TaskResolutionService,
        private hooks: CreatureInteractionHooks,
    ) {}

    get selectedId(): string | null { return this.selectedTaskId; }

    pressStart(taskId: string): void {
        if (this.role !== null || !this.repository.getById(taskId)) return;
        this.activeTaskId = taskId;
        // Role is frozen at gesture start. A selection gesture can never become
        // a resolve gesture, even if it is held past the threshold.
        this.role = this.selectedTaskId === taskId ? "resolve" : "select";
        this.elapsedS = 0;
        this.completedThisGesture = false;
        this.hooks.onResolveProgress(0);
    }

    update(deltaS: number): void {
        if (this.role === null) return;
        this.elapsedS += Math.max(0, deltaS);
        if (this.role !== "resolve" || this.completedThisGesture || !this.activeTaskId) return;
        const progress = Math.min(1, this.elapsedS / RESOLVE_HOLD_DURATION_S);
        this.hooks.onResolveProgress(progress);
        if (progress >= 1) {
            this.completedThisGesture = true;
            if (this.resolution.resolve(this.activeTaskId)) {
                this.selectedTaskId = null;
                this.hooks.onSelectionChanged(null);
            }
        }
    }

    pressEnd(): void {
        if (this.role === "select" && this.activeTaskId) {
            this.selectedTaskId = this.activeTaskId;
            this.hooks.onSelectionChanged(this.selectedTaskId);
        } else if (this.role === "resolve" && !this.completedThisGesture) {
            // Early release cancels only the hold; selection and repository stay.
            this.hooks.onResolveProgress(0);
        }
        this.activeTaskId = null;
        this.role = null;
        this.elapsedS = 0;
        this.completedThisGesture = false;
    }

    /**
     * Closes the panel without touching the task. Playbook v3 §3.2: "tapping
     * elsewhere deselects" — a pinch that lands on no creature.
     *
     * This is the only way out of a selection that neither defers the task nor
     * completes it. Without it, a user who opens the panel and changes their
     * mind has no exit at all.
     *
     * Writes nothing: no repository call, no resolution. Returns whether
     * anything was actually deselected, so a caller can tell a real dismissal
     * from a pinch into empty space with no panel open.
     */
    deselect(): boolean {
        // Never interrupt a gesture already in flight on a creature. A miss
        // cannot happen mid-press in practice, but if the interactor ever
        // reports one, the press that IS underway owns the state.
        if (this.role !== null) return false;
        if (!this.selectedTaskId) return false;
        this.selectedTaskId = null;
        this.hooks.onResolveProgress(0);
        this.hooks.onSelectionChanged(null);
        return true;
    }

    later(): boolean {
        if (!this.selectedTaskId) return false;
        if (!this.repository.snooze(this.selectedTaskId, LATER_SNOOZE_DURATION_MS)) return false;
        this.selectedTaskId = null;
        this.hooks.onResolveProgress(0);
        this.hooks.onSelectionChanged(null);
        return true;
    }
}
