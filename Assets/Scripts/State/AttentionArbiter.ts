import { TaskRecord } from "../Data/TaskRecord";
import { StateEngine } from "./StateEngine";

/** Selects zero or one threshold-eligible chaser. */
export class AttentionArbiter {
    constructor(private stateEngine: StateEngine) {}

    selectChaser(tasks: TaskRecord[]): TaskRecord | null {
        let selected: TaskRecord | null = null;
        let selectedUrgency = -Infinity;
        for (const task of tasks) {
            if (!this.stateEngine.isEligibleToChase(task)) continue;
            const urgency = this.stateEngine.urgency(task);
            if (selected === null || urgency > selectedUrgency) {
                selected = task;
                selectedUrgency = urgency;
            }
        }
        return selected ? { ...selected } : null;
    }
}
