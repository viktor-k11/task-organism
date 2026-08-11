import { DemoClock } from "../Scripts/Data/Clock";
import { TaskRepository } from "../Scripts/Data/TaskRepository";
import { TaskResolutionService } from "../Scripts/State/TaskResolutionService";
import { CreatureInteractionState } from "../Scripts/Interaction/CreatureInteractionState";
import { CountingTaskStorage, gateTask } from "./Gate2Support";

export function interactionFixture(): {
    storage: CountingTaskStorage;
    repository: TaskRepository;
    state: CreatureInteractionState;
    releases: () => number;
    progress: () => number;
} {
    const storage = new CountingTaskStorage();
    storage.tasks = [gateTask("interactive", "A complete task description for selection", 0)];
    const repository = new TaskRepository(storage, new DemoClock(100));
    repository.restore();
    let releaseCount = 0;
    let progressValue = 0;
    const resolution = new TaskResolutionService(repository, () => { releaseCount += 1; });
    const state = new CreatureInteractionState(repository, resolution, {
        onSelectionChanged: () => {},
        onResolveProgress: (value) => { progressValue = value; },
    });
    return { storage, repository, state, releases: () => releaseCount, progress: () => progressValue };
}

export function selectWithShortPinch(state: CreatureInteractionState): void {
    state.pressStart("interactive");
    state.update(0.1);
    state.pressEnd();
}
