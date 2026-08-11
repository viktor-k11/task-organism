import { Clock } from "../Data/Clock";
import { TaskRecord } from "../Data/TaskRecord";
import { TaskRepository } from "../Data/TaskRepository";

export interface TaskIdentitySource {
    next(text: string): { id: string; appearanceSeed: number };
}

export class SequentialTaskIdentitySource implements TaskIdentitySource {
    private sequence: number;
    constructor(private prefix: string = "task", startSequence: number = 0) {
        this.sequence = startSequence;
    }
    next(text: string): { id: string; appearanceSeed: number } {
        this.sequence += 1;
        let hash = 2166136261;
        for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
        return { id: `${this.prefix}-${this.sequence}`, appearanceSeed: (hash ^ this.sequence) >>> 0 };
    }
}

/** The single record-construction and repository path used by all inputs. */
export class TaskCreationService {
    constructor(
        private repository: TaskRepository,
        private clock: Clock,
        private identities: TaskIdentitySource,
    ) {}

    create(text: string): TaskRecord | null {
        const cleanText = text.trim();
        if (!cleanText) return null;
        const identity = this.identities.next(cleanText);
        const record: TaskRecord = {
            id: identity.id,
            text: cleanText,
            createdAtMs: this.clock.nowMs(),
            importance: "normal",
            deferCount: 0,
            status: "open",
            appearanceSeed: identity.appearanceSeed,
        };
        return this.repository.add(record) ? { ...record } : null;
    }
}
