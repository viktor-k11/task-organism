import { TaskRecord } from "../Data/TaskRecord";
import { TaskCreationService } from "./TaskCreationService";
import { TaskInputSource } from "./TaskInputSource";

/**
 * Six fixtures — the product's real capacity (CLAUDE.md: max 6 creatures
 * alive). DEMO_TASK_COUNT selects how many are actually seeded, so the demo
 * can be run at capacity rather than at a comfortable three.
 */
export const DEMO_TASK_FIXTURES = [
    "Send the project update",
    "Book a dentist appointment",
    "Water the balcony plants",
    "Reply to the landlord",
    "Renew the travel insurance",
    "Return the library books",
];

export class DemoInput implements TaskInputSource {
    constructor(private creator: TaskCreationService) {}
    submit(text: string): TaskRecord | null { return this.creator.create(text); }
    seedFixtures(): TaskRecord[] {
        const created: TaskRecord[] = [];
        for (const text of DEMO_TASK_FIXTURES) {
            const task = this.submit(text);
            if (task) created.push(task);
        }
        return created;
    }
}
