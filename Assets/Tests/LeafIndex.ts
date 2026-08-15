import { scenariosIndex } from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator";
import { ScenarioMetadata } from "Leaf.lspkg/Scenarios/scenario/ScenarioMetadata";
import { DataLayerScenario } from "./DataLayerScenario";
import { Gate2LifecycleScenario } from "./Gate2LifecycleScenario";
import { Gate2PersistenceSeedScenario } from "./Gate2PersistenceSeedScenario";
import { Gate2PersistenceRestoreScenario } from "./Gate2PersistenceRestoreScenario";
import { Gate2ElapsedRestoreScenario } from "./Gate2ElapsedRestoreScenario";
import { Gate2ResolveScenario } from "./Gate2ResolveScenario";
import { Gate3InputParityScenario } from "./Gate3InputParityScenario";
import { Gate3ShortPinchScenario } from "./Gate3ShortPinchScenario";
import { Gate3EarlyCancelScenario } from "./Gate3EarlyCancelScenario";
import { Gate3CompletedHoldScenario } from "./Gate3CompletedHoldScenario";
import { Gate3NoConflictScenario } from "./Gate3NoConflictScenario";
import { Gate3LaterScenario } from "./Gate3LaterScenario";
import { Gate4ControllerSurvivesReleaseScenario } from "./Gate4ControllerSurvivesReleaseScenario";
import { Gate5SnoozeRuntimePathScenario } from "./Gate5SnoozeRuntimePathScenario";

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
        { id: "gate3-input-parity", typename: Gate3InputParityScenario.getTypeName() },
        { id: "gate3-short-pinch-select", typename: Gate3ShortPinchScenario.getTypeName() },
        { id: "gate3-early-hold-cancel", typename: Gate3EarlyCancelScenario.getTypeName() },
        { id: "gate3-completed-hold", typename: Gate3CompletedHoldScenario.getTypeName() },
        { id: "gate3-no-gesture-conflict", typename: Gate3NoConflictScenario.getTypeName() },
        { id: "gate3-later-snooze", typename: Gate3LaterScenario.getTypeName() },
        // Gate 4 is the only scenario that inspects the SCENE OBJECT GRAPH
        // rather than the domain. It exists because all twelve above passed
        // while the composition root was silently being disabled on release.
        { id: "gate4-controller-survives-release", typename: Gate4ControllerSurvivesReleaseScenario.getTypeName() },
        // Gate 5 drives CreatureInteractionState.later() — the method the Later
        // button actually calls — rather than repository.snooze(). gate3-later-snooze
        // passed for the project's whole life while this path had never run.
        { id: "gate5-snooze-runtime-path", typename: Gate5SnoozeRuntimePathScenario.getTypeName() },
    ];
}
