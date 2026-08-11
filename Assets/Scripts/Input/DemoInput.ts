import { TaskRecord } from "../Data/TaskRecord";
import { TaskCreationService } from "./TaskCreationService";
import { TaskInputSource } from "./TaskInputSource";

export const DEMO_TASK_FIXTURES = [
    "Send the project update",
    "Book a dentist appointment",
    "Water the balcony plants",
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
