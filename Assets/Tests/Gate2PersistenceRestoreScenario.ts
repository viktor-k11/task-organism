import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { DemoClock } from "../Scripts/Data/Clock";
import { TaskRepository } from "../Scripts/Data/TaskRepository";
import { PersistentTaskStorage } from "../Scripts/Data/TaskStorage";
import { GATE2_PERSISTENCE_KEY } from "./Gate2Support";

@component
export class Gate2PersistenceRestoreScenario extends Scenario {
    async run(): Promise<void> {
        const repository = new TaskRepository(
            new PersistentTaskStorage(global.persistentStorageSystem.store, GATE2_PERSISTENCE_KEY),
            new DemoClock(20),
        );
        const tasks = repository.restore();
        expect(tasks.length).toBe(1);
        expect(tasks[0].id).toBe("persist-id");
        expect(tasks[0].text).toBe("Persisted task text");
        global.persistentStorageSystem.store.remove(GATE2_PERSISTENCE_KEY);
        console.log("[Gate2.5 restore] same id and text restored after Lens reset");
    }
}
