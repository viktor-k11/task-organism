import { isTaskRecord, TaskRecord } from "./TaskRecord";

export const TASK_STORAGE_SCHEMA_VERSION = 1;
export const TASK_STORAGE_KEY = "task-organism.tasks";

interface StoragePayloadV1 {
    schemaVersion: 1;
    tasks: TaskRecord[];
}

export interface TaskStorage {
    load(): TaskRecord[];
    save(tasks: TaskRecord[]): void;
}

/** Lens-backed JSON storage. Invalid or unknown payloads recover to empty. */
export class PersistentTaskStorage implements TaskStorage {
    constructor(
        private store: GeneralDataStore = global.persistentStorageSystem.store,
        private key: string = TASK_STORAGE_KEY,
    ) {}

    load(): TaskRecord[] {
        if (!this.store.has(this.key)) return [];
        try {
            const parsed = JSON.parse(this.store.getString(this.key)) as Partial<StoragePayloadV1>;
            if (parsed.schemaVersion !== TASK_STORAGE_SCHEMA_VERSION || !Array.isArray(parsed.tasks)) return [];
            return parsed.tasks.filter(isTaskRecord).filter((task) => task.status === "open").map((task) => ({ ...task }));
        } catch (_error) {
            return [];
        }
    }

    save(tasks: TaskRecord[]): void {
        const payload: StoragePayloadV1 = {
            schemaVersion: TASK_STORAGE_SCHEMA_VERSION,
            tasks: tasks.filter((task) => task.status === "open").map((task) => ({ ...task })),
        };
        this.store.putString(this.key, JSON.stringify(payload));
    }
}

/** Small deterministic adapter for repository and Preview tests. */
export class MemoryTaskStorage implements TaskStorage {
    private tasks: TaskRecord[];

    constructor(initialTasks: TaskRecord[] = []) {
        this.tasks = initialTasks.map((task) => ({ ...task }));
    }

    load(): TaskRecord[] {
        return this.tasks.map((task) => ({ ...task }));
    }

    save(tasks: TaskRecord[]): void {
        this.tasks = tasks.filter((task) => task.status === "open").map((task) => ({ ...task }));
    }
}
