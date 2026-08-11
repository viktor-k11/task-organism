import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { RESOLVE_HOLD_DURATION_S } from "../Scripts/Config/CreatureConfig";
import { interactionFixture } from "./Gate3Support";

@component
export class Gate3NoConflictScenario extends Scenario {
    async run(): Promise<void> {
        const f = interactionFixture();
        // Even an overlong first gesture has the role captured as selection.
        f.state.pressStart("interactive");
        f.state.update(RESOLVE_HOLD_DURATION_S * 2);
        f.state.pressEnd();
        expect(f.state.selectedId).toBe("interactive");
        expect(f.repository.getById("interactive") !== null).toBe(true);
        expect(f.storage.saveCount).toBe(0);
        expect(f.releases()).toBe(0);
        console.log("[Gate3.conflict] selection gesture could not resolve, regardless of duration");
    }
}
