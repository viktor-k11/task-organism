import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { interactionFixture, selectWithShortPinch } from "./Gate3Support";

@component
export class Gate3LaterScenario extends Scenario {
    async run(): Promise<void> {
        const f = interactionFixture();
        selectWithShortPinch(f.state);
        expect(f.state.later()).toBe(true);
        expect(f.state.selectedId).toBeNull();
        expect(f.repository.getById("interactive")!.snoozedUntilMs !== undefined).toBe(true);
        expect(f.storage.saveCount).toBe(1);
        expect(f.releases()).toBe(0);
        console.log("[Gate3.later] Later snoozed and closed selection without release");
    }
}
