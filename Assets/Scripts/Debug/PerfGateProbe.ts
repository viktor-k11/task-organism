/**
 * PerfGateProbe — measures the one performance number this project actually
 * regressed on, and then fixed.
 *
 * WHY THIS EXISTS RATHER THAN A PERFETTO TRACE
 * --------------------------------------------
 * The release frame at six creatures cost 551ms because `play()` built a mesh
 * and created 30 SceneObjects in a single frame. Pooling took it to ~224ms.
 * That number was found with Perfetto, which is the right tool for *attribution*
 * — it tells you which slice grew. It is the wrong tool for a *gate*: it needs
 * the trace processor, a multi-megabyte artifact per run, and a human reading
 * slice tables.
 *
 * A gate needs one number, cheaply, every run. So the runtime reports it.
 * Consumed by Tools/build-gate.js stage 4; see HANDOFF-VISUAL.md §8.
 *
 * WHY A WINDOW AND NOT A RUN-WIDE MAX
 * -----------------------------------
 * A run-wide max would be unusable here, and the project already has the
 * evidence for that: after pooling, the trace-wide max got *worse* (551 -> 754ms)
 * while the release itself got 59% cheaper. That 754ms spike sat at t+6.3s,
 * nowhere near a release — it was `Track` (desktop webcam/world tracking) on a
 * loaded machine. Gating on a run-wide max would fail on a busy laptop and pass
 * on a real regression.
 *
 * So the probe measures only the frames immediately following a release, which
 * is the window the pooling change actually touches.
 *
 * WHY THE WINDOW STARTS ON THE FRAME AFTER THE RELEASE
 * ----------------------------------------------------
 * `getDeltaTime()` on frame N reports how long frame N-1 took. The construction
 * cost of a release issued on frame R therefore surfaces in the delta read on
 * frame R+1, not on R. The window covers the frames after the mark for exactly
 * this reason — reading the delta on the release frame itself would measure the
 * frame before the release and always look fine.
 */

/** Frames sampled after a release. Twelve is ~0.5s of preview frames at the
 *  observed ~43ms/frame median — comfortably wider than the one-frame spike,
 *  narrow enough that unrelated tracking hitches rarely land inside it. */
const RELEASE_WINDOW_FRAMES = 12;

class PerfGateProbeImpl {
    private releaseIndex = 0;
    private framesLeft = 0;
    private maxMs = 0;
    private creatureCount = 0;

    /**
     * Called when a release is issued. Any window still open is flushed first,
     * so two releases close together each report their own number rather than
     * the second silently overwriting the first.
     */
    markRelease(creatureCount: number): void {
        if (this.framesLeft > 0) this.flush();
        this.releaseIndex++;
        this.framesLeft = RELEASE_WINDOW_FRAMES;
        this.maxMs = 0;
        this.creatureCount = creatureCount;
    }

    /** Called once per frame with the frame delta in seconds. No-op outside a
     *  release window, so the cost in the normal case is one comparison. */
    sample(dtSeconds: number): void {
        if (this.framesLeft <= 0) return;
        const ms = dtSeconds * 1000;
        if (ms > this.maxMs) this.maxMs = ms;
        this.framesLeft--;
        if (this.framesLeft <= 0) this.flush();
    }

    /** One line per release, parsed by Tools/build-gate.js. The format is a
     *  contract — the gate matches on `[PerfGate] release=` and reads
     *  `maxFrameMs`. Changing it breaks the perf stage. */
    private flush(): void {
        this.framesLeft = 0;
        console.log(
            `[PerfGate] release=${this.releaseIndex} creatures=${this.creatureCount} ` +
                `maxFrameMs=${this.maxMs.toFixed(1)} window=${RELEASE_WINDOW_FRAMES}`
        );
    }
}

/** Single shared instance. Deliberately not a BaseScriptComponent: it needs no
 *  scene object, no Inspector surface and no attachment step — the controller
 *  already has the only update loop it needs to ride on. */
export const PerfGate = new PerfGateProbeImpl();
