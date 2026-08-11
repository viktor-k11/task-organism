import { TaskRepository } from "../Data/TaskRepository";

export type ReleaseTaskPresentation = (taskId: string) => void;

/** Repository mutation succeeds before the one-shot presentation callback. */
export class TaskResolutionService {
    constructor(
        private repository: TaskRepository,
        private releasePresentation: ReleaseTaskPresentation,
    ) {}

    resolve(taskId: string): boolean {
        if (!this.repository.resolve(taskId)) return false;
        this.releasePresentation(taskId);
        return true;
    }
}
