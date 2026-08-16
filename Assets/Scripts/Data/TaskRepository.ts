import { Clock } from "./Clock";
import { copyTask, isTaskRecord, TaskRecord } from "./TaskRecord";
import { TaskStorage } from "./TaskStorage";

export const MAX_OPEN_TASKS = 6;

export class TaskRepository {
    private tasks: TaskRecord[] = [];

    constructor(private storage: TaskStorage, private clock: Clock) {}

    restore(): TaskRecord[] {
        this.tasks = this.storage.load()
            .filter(isTaskRecord)
            .filter((task) => task.status === "open")
            .slice(0, MAX_OPEN_TASKS)
            .map(copyTask);
        return this.listOpen();
    }

    listOpen(): TaskRecord[] {
        return this.tasks.filter((task) => task.status === "open").map(copyTask);
    }

    getById(id: string): TaskRecord | null {
        const task = this.tasks.find((candidate) => candidate.id === id && candidate.status === "open");
        return task ? copyTask(task) : null;
    }

    add(task: TaskRecord): boolean {
        if (!isTaskRecord(task) || task.status !== "open") return false;
        if (this.tasks.some((candidate) => candidate.id === task.id)) return false;
        if (this.listOpen().length >= MAX_OPEN_TASKS) return false;
        this.tasks.push(copyTask(task));
        this.persist();
        return true;
    }

    snooze(id: string, durationMs: number): boolean {
        const task = this.tasks.find((candidate) => candidate.id === id && candidate.status === "open");
        if (!task || durationMs <= 0) return false;
        task.deferCount += 1;
        task.snoozedUntilMs = this.clock.nowMs() + durationMs;
        this.persist();
        return true;
    }

    /**
     * Removes a task WITHOUT completing it — used while the user is still
     * writing their list. Distinct from resolve() on purpose: discarding is
     * not an achievement, so it must not release a creature, play the
     * completion effect, or appear in TODAY.TXT.
     */
    discard(id: string): boolean {
        const before = this.tasks.length;
        this.tasks = this.tasks.filter((candidate) => candidate.id !== id);
        if (this.tasks.length === before) return false;
        this.persist();
        return true;
    }

    /** Idempotent: only the first resolve mutates and persists. */
    resolve(id: string): boolean {
        const task = this.tasks.find((candidate) => candidate.id === id && candidate.status === "open");
        if (!task) return false;
        task.status = "done";
        this.persist();
        this.tasks = this.tasks.filter((candidate) => candidate.status === "open");
        return true;
    }

    private persist(): void {
        this.storage.save(this.tasks);
    }
}
