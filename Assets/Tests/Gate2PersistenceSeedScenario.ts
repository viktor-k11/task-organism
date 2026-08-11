import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { DemoClock } from "../Scripts/Data/Clock";
import { TaskRepository } from "../Scripts/Data/TaskRepository";
import { PersistentTaskStorage } from "../Scripts/Data/TaskStorage";
import { gateTask, GATE2_PERSISTENCE_KEY } from "./Gate2Support";

@component
export class Gate2PersistenceSeedScenario extends Scenario {
    async run(): Promise<void> {
        global.persistentStorageSystem.store.remove(GATE2_PERSISTENCE_KEY);
        const repository = new TaskRepository(
            new PersistentTaskStorage(global.persistentStorageSystem.store, GATE2_PERSISTENCE_KEY),
            new DemoClock(10),
        );
        repository.restore();
        expect(repository.add(gateTask("persist-id", "Persisted task text", 10))).toBe(true);
        console.log("[Gate2.5 seed] persisted id=persist-id text=Persisted task text");
    }
}
