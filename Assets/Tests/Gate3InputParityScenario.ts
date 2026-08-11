import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { DemoClock } from "../Scripts/Data/Clock";
import { TaskRepository } from "../Scripts/Data/TaskRepository";
import { MemoryTaskStorage } from "../Scripts/Data/TaskStorage";
import { DemoInput } from "../Scripts/Input/DemoInput";
import { KeyboardInput } from "../Scripts/Input/KeyboardInput";
import { SequentialTaskIdentitySource, TaskCreationService } from "../Scripts/Input/TaskCreationService";

@component
export class Gate3InputParityScenario extends Scenario {
    async run(): Promise<void> {
        const clockA = new DemoClock(42_000);
        const clockB = new DemoClock(42_000);
        const demoRepo = new TaskRepository(new MemoryTaskStorage(), clockA); demoRepo.restore();
        const keyboardRepo = new TaskRepository(new MemoryTaskStorage(), clockB); keyboardRepo.restore();
        const demo = new DemoInput(new TaskCreationService(demoRepo, clockA, new SequentialTaskIdentitySource("same")));
        const keyboard = new KeyboardInput(new TaskCreationService(keyboardRepo, clockB, new SequentialTaskIdentitySource("same")));
        const fromDemo = demo.submit("Equivalent task");
        const fromKeyboard = keyboard.submit("Equivalent task");
        expect(fromDemo).toEqual(fromKeyboard);
        expect(fromDemo!.deadlineAtMs).toBe(undefined);
        expect(fromDemo!.importance).toBe("normal");
        expect(fromDemo!.deferCount).toBe(0);
        console.log("[Gate3.input] DemoInput and KeyboardInput created equivalent records through TaskCreationService");
    }
}
