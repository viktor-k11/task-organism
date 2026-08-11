import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { interactionFixture, selectWithShortPinch } from "./Gate3Support";

@component
export class Gate3ShortPinchScenario extends Scenario {
    async run(): Promise<void> {
        const f = interactionFixture();
        selectWithShortPinch(f.state);
        expect(f.state.selectedId).toBe("interactive");
        expect(f.repository.getById("interactive") !== null).toBe(true);
        expect(f.storage.saveCount).toBe(0);
        expect(f.releases()).toBe(0);
        console.log("[Gate3.select] short pinch selected without resolving");
    }
}
