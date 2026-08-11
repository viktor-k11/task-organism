/** The only time source consumed by task/state code. */
export interface Clock {
    nowMs(): number;
}

export class RealClock implements Clock {
    nowMs(): number {
        return Date.now();
    }
}

/** Deterministic clock for Preview fixtures and elapsed-time tests. */
export class DemoClock implements Clock {
    constructor(private currentMs: number = 0) {}

    nowMs(): number {
        return this.currentMs;
    }

    setNowMs(value: number): void {
        this.currentMs = value;
    }

    advanceMs(deltaMs: number): void {
        this.currentMs += deltaMs;
    }
}
