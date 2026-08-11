import { scenariosIndex } from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator";
import { ScenarioMetadata } from "Leaf.lspkg/Scenarios/scenario/ScenarioMetadata";
import { DataLayerScenario } from "./DataLayerScenario";
import { Gate2LifecycleScenario } from "./Gate2LifecycleScenario";
import { Gate2PersistenceSeedScenario } from "./Gate2PersistenceSeedScenario";
import { Gate2PersistenceRestoreScenario } from "./Gate2PersistenceRestoreScenario";
import { Gate2ElapsedRestoreScenario } from "./Gate2ElapsedRestoreScenario";
import { Gate2ResolveScenario } from "./Gate2ResolveScenario";

@component
export class LeafIndex extends BaseScriptComponent {
    @scenariosIndex
    static scenariosIndex: ScenarioMetadata[] = [
        {
            id: "task-organism-data-layer",
            typename: DataLayerScenario.getTypeName(),
        },
        { id: "gate2-1-4-chaser-lifecycle", typename: Gate2LifecycleScenario.getTypeName() },
        { id: "gate2-5-persistence-seed", typename: Gate2PersistenceSeedScenario.getTypeName() },
        { id: "gate2-5-persistence-restore", typename: Gate2PersistenceRestoreScenario.getTypeName() },
        { id: "gate2-6-8-elapsed-clock", typename: Gate2ElapsedRestoreScenario.getTypeName() },
        { id: "gate2-7-resolve-idempotency", typename: Gate2ResolveScenario.getTypeName() },
    ];
}
