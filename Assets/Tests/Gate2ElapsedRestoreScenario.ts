import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { URGENCY_AGE_WINDOW_MS } from "../Scripts/Config/CreatureConfig";
import { DemoClock } from "../Scripts/Data/Clock";
import { MemoryTaskStorage } from "../Scripts/Data/TaskStorage";
import { buildGate, gateTask } from "./Gate2Support";

@component
export class Gate2ElapsedRestoreScenario extends Scenario {
    async run(): Promise<void> {
        const stored = new MemoryTaskStorage([gateTask("elapsed", "Elapsed restore", 0)]);
        const clock = new DemoClock(URGENCY_AGE_WINDOW_MS + 1);
        const gate = buildGate(clock, stored);
        const chaser = gate.arbiter.selectChaser(gate.repository.listOpen());
        expect(chaser !== null).toBe(true);
        expect(chaser!.id).toBe("elapsed");
        console.log("[Gate2.6] restored task transitioned by elapsed DemoClock time without waiting");
        console.log("[Gate2.8 runtime] StateEngine transition driven by injected DemoClock");
    }
}
