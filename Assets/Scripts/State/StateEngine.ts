import {
    CHASE_THRESHOLD,
    HIGH_IMPORTANCE_URGENCY_BONUS,
    URGENCY_AGE_WINDOW_MS,
} from "../Config/CreatureConfig";
import { Clock } from "../Data/Clock";
import { TaskRecord } from "../Data/TaskRecord";

export type BehaviorState = "CALM" | "URGENT" | "CHASING";

/** Pure derived state. Time enters exclusively through the injected Clock. */
export class StateEngine {
    constructor(private clock: Clock) {}

    nowMs(): number {
        return this.clock.nowMs();
    }

    urgency(task: TaskRecord): number {
        const now = this.clock.nowMs();
        const ageMs = Math.max(0, now - task.createdAtMs);
        const importanceBonus = task.importance === "high" ? HIGH_IMPORTANCE_URGENCY_BONUS : 0;
        const deadlineBonus = task.deadlineAtMs !== undefined && now >= task.deadlineAtMs ? CHASE_THRESHOLD : 0;
        return ageMs / URGENCY_AGE_WINDOW_MS + importanceBonus + deadlineBonus;
    }

    isEligibleToChase(task: TaskRecord): boolean {
        const now = this.clock.nowMs();
        return task.status === "open"
            && now >= (task.snoozedUntilMs ?? 0)
            && this.urgency(task) >= CHASE_THRESHOLD;
    }

    deriveState(task: TaskRecord, isChaser: boolean): BehaviorState {
        if (isChaser) return "CHASING";
        return this.urgency(task) >= CHASE_THRESHOLD ? "URGENT" : "CALM";
    }
}
