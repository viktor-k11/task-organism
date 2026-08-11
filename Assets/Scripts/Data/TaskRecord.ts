export type TaskImportance = "normal" | "high";
export type TaskStatus = "open" | "done";

export interface TaskRecord {
    id: string;
    text: string;
    createdAtMs: number;
    deadlineAtMs?: number;
    importance: TaskImportance;
    deferCount: number;
    snoozedUntilMs?: number;
    status: TaskStatus;
    appearanceSeed: number;
}

export function isTaskRecord(value: unknown): value is TaskRecord {
    if (!value || typeof value !== "object") return false;
    const task = value as Record<string, unknown>;
    return typeof task.id === "string"
        && task.id.length > 0
        && typeof task.text === "string"
        && typeof task.createdAtMs === "number"
        && (task.deadlineAtMs === undefined || typeof task.deadlineAtMs === "number")
        && (task.importance === "normal" || task.importance === "high")
        && typeof task.deferCount === "number"
        && task.deferCount >= 0
        && (task.snoozedUntilMs === undefined || typeof task.snoozedUntilMs === "number")
        && (task.status === "open" || task.status === "done")
        && typeof task.appearanceSeed === "number";
}

export function copyTask(task: TaskRecord): TaskRecord {
    return { ...task };
}
