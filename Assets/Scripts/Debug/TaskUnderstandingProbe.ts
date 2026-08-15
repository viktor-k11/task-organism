import { OpenAI } from "RemoteServiceGateway.lspkg/HostedExternal/OpenAI";
import { OpenAITypes } from "RemoteServiceGateway.lspkg/HostedExternal/OpenAITypes";

/**
 * THROWAWAY PROBE — feasibility measurement only, not a feature.
 *
 * Answers three questions the decision depends on, by measurement rather than
 * estimate:
 *   1. What does one task-understanding call actually cost in Preview?
 *   2. Does it work in Preview at all, with no device attached?
 *   3. When the call cannot succeed, does it REJECT (recoverable) or HANG
 *      (which would be fatal — a hung promise behind task creation means the
 *      user's task never appears).
 *
 * Delete this file and its scene object once the numbers are recorded.
 */

const SYSTEM_PROMPT =
    "You classify a short task description. Reply with ONLY compact JSON, no prose, " +
    'of the form {"importance":"normal"|"high","urgencyHintHours":number|null}. ' +
    "urgencyHintHours is your estimate of hours from now until the task is due, or null if the text gives no timing.";

const SAMPLES = [
    "call mom tomorrow",
    "finish the deck by Friday",
    "buy milk",
    "submit the tax return before the deadline on the 31st",
    "reply to the landlord",
];

@component
export class TaskUnderstandingProbe extends BaseScriptComponent {
    onAwake(): void {
        this.createEvent("OnStartEvent").bind(() => this.run());
    }

    private async run(): Promise<void> {
        const online = global.deviceInfoSystem.isInternetAvailable();
        print(`[Probe] start — isInternetAvailable=${online}`);

        // ── Pass 1: cold call. Isolated because the first call carries
        // connection setup the later ones reuse; averaging it in would flatter
        // the steady-state number and overstate the cold-start cost.
        await this.timed("cold", SAMPLES[0]);

        // ── Pass 2: warm calls.
        const warm: number[] = [];
        for (let i = 1; i < SAMPLES.length; i++) {
            const ms = await this.timed(`warm${i}`, SAMPLES[i]);
            if (ms > 0) warm.push(ms);
        }
        if (warm.length > 0) {
            warm.sort((a, b) => a - b);
            const sum = warm.reduce((a, b) => a + b, 0);
            print(
                `[Probe] WARM n=${warm.length} min=${warm[0]}ms median=${warm[Math.floor(warm.length / 2)]}ms ` +
                `max=${warm[warm.length - 1]}ms mean=${Math.round(sum / warm.length)}ms`
            );
        }

        // ── Pass 3: the failure path. A bad token is the closest reproducible
        // stand-in for "the call cannot succeed" available in Preview. What
        // matters is not the error itself but whether the promise SETTLES.
        await this.failurePath();

        print("[Probe] done");
    }

    private timed(label: string, text: string): Promise<number> {
        const t0 = getTime();
        const req: OpenAITypes.ChatCompletions.Request = {
            model: "gpt-4.1-nano",
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: text },
            ],
            temperature: 0,
        };
        return OpenAI.chatCompletions(req)
            .then((resp) => {
                const ms = Math.round((getTime() - t0) * 1000);
                const reply = resp.choices[0].message.content as string;
                print(`[Probe] ${label} ${ms}ms in="${text}" out=${reply.replace(/\s+/g, " ").trim()}`);
                return ms;
            })
            .catch((err) => {
                const ms = Math.round((getTime() - t0) * 1000);
                print(`[Probe] ${label} FAILED after ${ms}ms: ${err}`);
                return -1;
            });
    }

    private failurePath(): Promise<void> {
        const t0 = getTime();
        let settled = false;

        // A watchdog is the only way to distinguish "rejected quickly" from
        // "never came back" — an unsettled promise produces no log line at all,
        // so its absence has to be detected actively.
        const watchdog = this.createEvent("DelayedCallbackEvent");
        watchdog.bind(() => {
            if (!settled) {
                print("[Probe] failure-path NO SETTLE after 15s — a hang, not a rejection");
            }
        });
        watchdog.reset(15.0);

        const req: OpenAITypes.ChatCompletions.Request = {
            model: "gpt-4.1-nano",
            messages: [{ role: "user", content: "ping" }],
        };
        return OpenAI.chatCompletions(req)
            .then(() => {
                settled = true;
                print(`[Probe] failure-path unexpectedly SUCCEEDED after ${Math.round((getTime() - t0) * 1000)}ms`);
            })
            .catch((err) => {
                settled = true;
                print(`[Probe] failure-path rejected after ${Math.round((getTime() - t0) * 1000)}ms: ${err}`);
            });
    }
}
