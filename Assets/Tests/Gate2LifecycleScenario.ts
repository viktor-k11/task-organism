import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { URGENCY_AGE_WINDOW_MS } from "../Scripts/Config/CreatureConfig";
import { DemoClock } from "../Scripts/Data/Clock";
import { MemoryTaskStorage } from "../Scripts/Data/TaskStorage";
import { buildGate, gateTask } from "./Gate2Support";

@component
export class Gate2LifecycleScenario extends Scenario {
    async run(): Promise<void> {
        const clock = new DemoClock(0);
        const gate = buildGate(clock, new MemoryTaskStorage());
        const urgent = gateTask("urgent", "Urgent task", 0);
        urgent.deadlineAtMs = 1_000;
        gate.repository.add(urgent);
        gate.repository.add(gateTask("fresh-b", "Fresh B", 0));
        gate.repository.add(gateTask("fresh-c", "Fresh C", 0));

        expect(gate.arbiter.selectChaser(gate.repository.listOpen())).toBeNull();
        console.log("[Gate2.1] three fresh tasks -> zero chasers");

        clock.setNowMs(1_001);
        const first = gate.arbiter.selectChaser(gate.repository.listOpen());
        expect(first !== null).toBe(true);
        expect(first!.id).toBe("urgent");
        console.log("[Gate2.2] one threshold task -> exactly one chaser: urgent");

        expect(gate.repository.snooze("urgent", 5_000)).toBe(true);
        expect(gate.arbiter.selectChaser(gate.repository.listOpen())).toBeNull();
        console.log("[Gate2.3] snoozed threshold task -> zero chasers");

        clock.advanceMs(5_001);
        const resumed = gate.arbiter.selectChaser(gate.repository.listOpen());
        expect(resumed !== null).toBe(true);
        expect(resumed!.id).toBe("urgent");
        // Other tasks remain far below the age threshold.
        expect(clock.nowMs() < URGENCY_AGE_WINDOW_MS).toBe(true);
        console.log("[Gate2.4] snooze expired -> exactly one chaser: urgent");
    }
}
