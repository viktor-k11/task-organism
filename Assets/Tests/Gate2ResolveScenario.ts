import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { DemoClock } from "../Scripts/Data/Clock";
import { TaskRepository } from "../Scripts/Data/TaskRepository";
import { TaskResolutionService } from "../Scripts/State/TaskResolutionService";
import { CountingTaskStorage, gateTask } from "./Gate2Support";

@component
export class Gate2ResolveScenario extends Scenario {
    async run(): Promise<void> {
        const storage = new CountingTaskStorage();
        storage.tasks = [gateTask("resolve-once", "Resolve once", 0)];
        const repository = new TaskRepository(storage, new DemoClock(100));
        repository.restore();
        let releases = 0;
        const service = new TaskResolutionService(repository, (_id) => { releases += 1; });

        expect(service.resolve("resolve-once")).toBe(true);
        expect(service.resolve("resolve-once")).toBe(false);
        expect(storage.saveCount).toBe(1);
        expect(releases).toBe(1);
        console.log("[Gate2.7] two resolve calls -> one repository save and one release event");
    }
}
