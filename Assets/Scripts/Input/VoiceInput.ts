import { TaskRecord } from "../Data/TaskRecord";
import { TaskCreationService } from "./TaskCreationService";
import { TaskInputSource } from "./TaskInputSource";
import { VOICE_WINDOW } from "../UI/UiCopy";

export interface VoiceInputHooks {
    /** Short user-facing line for the status text (already the demo's feedback channel). */
    onStatus(text: string): void;
}

/**
 * How long to wait for the speech service before giving up on a session.
 *
 * Measured: when Snap's ASR backend refuses the stream it can take FOUR AND A
 * HALF MINUTES to surface an error, during which the UI still says
 * "I'm listening…" and the user has no idea anything is wrong. This watchdog
 * turns that into an honest message in a few seconds.
 */
const NO_ANSWER_TIMEOUT_S = 12;

/**
 * Push-to-talk task creation through the ASR module.
 *
 * One toggle starts a single-utterance capture: the first FINAL transcript
 * becomes a task through the same TaskCreationService every other input uses,
 * then the session stops itself. Partial transcripts are surfaced on the
 * status line so the speaker can see they are being heard.
 *
 * Degrades honestly rather than breaking the demo:
 *   - AsrModule missing (runtime too old) -> status points at the K keyboard.
 *   - No internet / unauthenticated (ASR streams through Snap's service) ->
 *     status says so; nothing is created.
 *   - Task list full -> repository refuses, status explains; the transcript
 *     is not silently dropped into the void.
 *
 * ASR works in Lens Studio Preview (LS 5.9+), so this is verifiable without a
 * device — the earlier "device-only" scope note was outdated.
 */
export class VoiceInput implements TaskInputSource {
    private listening = false;
    private stopping = false;
    private asrModule: AsrModule | null = null;
    private moduleUnavailable = false;
    private heardAnything = false;
    private watchdogRemainingS = -1;

    /**
     * `script` is only used to own the watchdog clock — VoiceInput is a plain
     * class, not a component, so it cannot create its own update event.
     */
    constructor(
        private creator: TaskCreationService,
        private hooks: VoiceInputHooks,
        private script?: BaseScriptComponent,
    ) {}

    /** Driven from the controller's update loop. */
    update(dt: number): void {
        if (this.watchdogRemainingS < 0) return;
        this.watchdogRemainingS -= dt;
        if (this.watchdogRemainingS > 0) return;
        this.watchdogRemainingS = -1;
        if (this.listening && !this.heardAnything) {
            console.warn("[VoiceInput] no transcript within the timeout — treating as unreachable");
            this.stop(VOICE_WINDOW.noAnswer);
        }
    }

    get isListening(): boolean {
        return this.listening;
    }

    submit(text: string): TaskRecord | null {
        const task = this.creator.create(text);
        if (task) {
            this.hooks.onStatus(`added: ${task.text}`);
        } else if (text.trim()) {
            // The only repository refusal reachable from a clean transcript is
            // the open-task cap. Phrased as a state, not a scolding.
            this.hooks.onStatus("all six creatures are busy — release one first");
        }
        return task;
    }

    toggle(): void {
        if (this.listening) {
            this.stop("voice off");
        } else {
            this.start();
        }
    }

    start(): void {
        if (this.listening || this.stopping) return;
        if (!this.ensureModule()) {
            this.hooks.onStatus("voice not available here — press K to type");
            return;
        }
        const options = AsrModule.AsrTranscriptionOptions.create();
        options.silenceUntilTerminationMs = 1200;
        options.mode = AsrModule.AsrMode.HighAccuracy;
        options.onTranscriptionUpdateEvent.add((event: AsrModule.TranscriptionUpdateEvent) => {
            if (!this.listening) return;
            // Any syllable at all means the service IS reachable — stand the
            // watchdog down so a slow speaker is never cut off mid-sentence.
            this.heardAnything = true;
            this.watchdogRemainingS = -1;
            if (event.isFinal) {
                const text = event.text.trim();
                this.stop(text ? "" : "heard nothing — press V to try again");
                if (text) this.submit(text);
            } else if (event.text.trim()) {
                this.hooks.onStatus(`hearing: ${event.text.trim()}`);
            }
        });
        options.onTranscriptionErrorEvent.add((code: AsrModule.AsrStatusCode) => {
            // Code 3 (NoInternet) is what an unreachable/refused speech
            // backend reports even when the machine itself is online.
            const reason =
                code === AsrModule.AsrStatusCode.NoInternet
                    ? VOICE_WINDOW.noAnswer
                    : code === AsrModule.AsrStatusCode.Unauthenticated
                        ? "voice needs a signed-in Snap account — try typing instead"
                        : "voice hiccuped — press V to retry, or type instead";
            console.warn(`[VoiceInput] ASR error code=${code}`);
            this.stop(reason);
        });
        try {
            this.asrModule!.startTranscribing(options);
        } catch (error) {
            console.warn(`[VoiceInput] startTranscribing failed: ${error}`);
            this.moduleUnavailable = true;
            this.hooks.onStatus("voice not available here — press K to type");
            return;
        }
        this.listening = true;
        this.heardAnything = false;
        this.watchdogRemainingS = NO_ANSWER_TIMEOUT_S;
        this.hooks.onStatus("listening… say the task, pause to finish");
        console.log("[VoiceInput] session started");
    }

    stop(statusText: string): void {
        if (!this.listening || !this.asrModule) return;
        this.listening = false;
        this.stopping = true;
        this.watchdogRemainingS = -1;
        if (statusText) this.hooks.onStatus(statusText);
        // stopTranscribing returns a Promise; completion order does not matter
        // here because `listening` already gates every callback.
        this.asrModule
            .stopTranscribing()
            .then(() => {
                this.stopping = false;
                console.log("[VoiceInput] session stopped");
            })
            .catch((error: unknown) => {
                this.stopping = false;
                console.warn(`[VoiceInput] stopTranscribing failed: ${error}`);
            });
    }

    private ensureModule(): boolean {
        if (this.asrModule) return true;
        if (this.moduleUnavailable) return false;
        try {
            this.asrModule = require("LensStudio:AsrModule") as AsrModule;
            return true;
        } catch (error) {
            console.warn(`[VoiceInput] AsrModule unavailable: ${error}`);
            this.moduleUnavailable = true;
            return false;
        }
    }
}
