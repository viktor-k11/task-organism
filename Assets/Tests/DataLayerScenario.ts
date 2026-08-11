import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { DemoClock } from "../Scripts/Data/Clock";
import { TaskRepository } from "../Scripts/Data/TaskRepository";
import { MemoryTaskStorage, PersistentTaskStorage, TASK_STORAGE_KEY } from "../Scripts/Data/TaskStorage";
import { TaskRecord } from "../Scripts/Data/TaskRecord";

function task(id: string, createdAtMs: number): TaskRecord {
    return {
        id,
        text: `Task ${id}`,
        createdAtMs,
        importance: "normal",
        deferCount: 0,
        status: "open",
        appearanceSeed: createdAtMs,
    };
}

@component
export class DataLayerScenario extends Scenario {
    async run(): Promise<void> {
        const clock = new DemoClock(10_000);
        const memory = new MemoryTaskStorage();
        const repository = new TaskRepository(memory, clock);

        expect(repository.restore().length).toBe(0);
        expect(repository.add(task("a", 1))).toBe(true);
        expect(repository.add(task("b", 2))).toBe(true);
        expect(repository.add(task("c", 3))).toBe(true);
        expect(repository.listOpen().length).toBe(3);

        expect(repository.snooze("b", 5_000)).toBe(true);
        const snoozed = repository.getById("b");
        expect(snoozed !== null).toBe(true);
        expect(snoozed!.deferCount).toBe(1);
        expect(snoozed!.snoozedUntilMs).toBe(15_000);

        // Save occurs on the first resolve; the second request is a no-op.
        expect(repository.resolve("a")).toBe(true);
        expect(repository.resolve("a")).toBe(false);
        expect(memory.load().length).toBe(2);

        const restored = new TaskRepository(memory, clock);
        expect(restored.restore().length).toBe(2);

        const values: Record<string, string> = { [TASK_STORAGE_KEY]: "{not valid json" };
        const corruptStore = {
            has: (key: string) => values[key] !== undefined,
            getString: (key: string) => values[key] || "",
            putString: (key: string, value: string) => { values[key] = value; },
        } as GeneralDataStore;
        expect(new PersistentTaskStorage(corruptStore).load().length).toBe(0);
    }
}
