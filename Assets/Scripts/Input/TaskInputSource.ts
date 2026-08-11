import { TaskRecord } from "../Data/TaskRecord";

/** Shared seam for every supported task input. */
export interface TaskInputSource {
    submit(text: string): TaskRecord | null;
}
