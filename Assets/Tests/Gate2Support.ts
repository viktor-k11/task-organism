import { Clock, DemoClock } from "../Scripts/Data/Clock";
import { TaskRecord } from "../Scripts/Data/TaskRecord";
import { TaskStorage } from "../Scripts/Data/TaskStorage";
import { TaskRepository } from "../Scripts/Data/TaskRepository";
import { AttentionArbiter } from "../Scripts/State/AttentionArbiter";
import { StateEngine } from "../Scripts/State/StateEngine";

export const GATE2_PERSISTENCE_KEY = "task-organism.gate2.persistence";

export function gateTask(id: string, text: string, createdAtMs: number): TaskRecord {
    return { id, text, createdAtMs, importance: "normal", deferCount: 0, status: "open", appearanceSeed: createdAtMs };
}

export function buildGate(clock: Clock, storage: TaskStorage): { repository: TaskRepository; arbiter: AttentionArbiter } {
    const repository = new TaskRepository(storage, clock);
    repository.restore();
    return { repository, arbiter: new AttentionArbiter(new StateEngine(clock)) };
}

export class CountingTaskStorage implements TaskStorage {
    tasks: TaskRecord[] = [];
    saveCount = 0;
    load(): TaskRecord[] { return this.tasks.map((task) => ({ ...task })); }
    save(tasks: TaskRecord[]): void {
        this.saveCount += 1;
        this.tasks = tasks.filter((task) => task.status === "open").map((task) => ({ ...task }));
    }
}

export function freshThree(clock: DemoClock, repository: TaskRepository): void {
    const now = clock.nowMs();
    repository.add(gateTask("fresh-a", "Fresh A", now));
    repository.add(gateTask("fresh-b", "Fresh B", now));
    repository.add(gateTask("fresh-c", "Fresh C", now));
}
