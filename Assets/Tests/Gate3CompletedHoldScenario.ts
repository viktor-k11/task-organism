import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { RESOLVE_HOLD_DURATION_S } from "../Scripts/Config/CreatureConfig";
import { interactionFixture, selectWithShortPinch } from "./Gate3Support";

@component
export class Gate3CompletedHoldScenario extends Scenario {
    async run(): Promise<void> {
        const f = interactionFixture();
        selectWithShortPinch(f.state);
        f.state.pressStart("interactive");
        f.state.update(RESOLVE_HOLD_DURATION_S + 0.01);
        f.state.update(1);
        f.state.pressEnd();
        expect(f.repository.getById("interactive")).toBeNull();
        expect(f.storage.saveCount).toBe(1);
        expect(f.releases()).toBe(1);
        console.log("[Gate3.resolve] completed hold saved once then released once");
    }
}
