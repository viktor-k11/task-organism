import { INTRO, MANUAL_WINDOW, REVIEW_WINDOW, TYPING_WINDOW, VOICE_WINDOW } from "./UiCopy";
import { buildBackdrop, ICON_COMPUTER, RetroDialog } from "./RetroUi";
import { resolveAnchor, UI_ANCHORS } from "./UiLayout";

export interface OnboardingHooks {
    /** Open the AR/desktop keyboard so typed lines become tasks. */
    openKeyboard(): void;
    /** Remove the most recently added task. Returns true if one went. */
    removeLastTask(): boolean;
    /** Clear every leftover task from a previous session — the intro's
     *  buttons commit the user to a NEW day's list. */
    startFreshDay(): void;
    /** Begin one voice capture (a pause ends the utterance -> one task). */
    startVoice(): void;
    /** Current open task texts, for the review screen. */
    listTasks(): string[];
    /** Short line on the status channel. */
    status(text: string): void;
    onFinished(): void;
}


/**
 * The retro-desktop onboarding: the hill wallpaper standing in the room
 * (the same world-anchored treatment as the closing ritual's landscape),
 * with the system-message dialogs in front. One dialog is visible at a
 * time; the backdrop stays behind all of them until the flow finishes.
 *
 * PLACEHOLDER SEQUENCING NOTE: the demo world (and any restored tasks)
 * already exist behind the backdrop — this flow currently *adds* tasks
 * rather than gating world creation. Deferring the world until onboarding
 * finishes is an engineering pass after the design locks; every screen and
 * button here is already the real flow.
 *
 * Voice tier note: today each pause = one task (AsrModule single-utterance
 * sessions). The LLM tier sends the whole messy transcript to a model that
 * returns clean task lines — the review screen already protects the user
 * either way.
 */
export class OnboardingFlow {
    private camera: SceneObject;
    private current: RetroDialog | null = null;
    private backdrop: SceneObject | null = null;

    private dialogAnchor: SceneObject;
    /** Which screen is showing, so a newly created task can refresh it. */
    private screen: "intro" | "manual" | "typing" | "voice" | "review" | "none" = "none";

    constructor(private script: BaseScriptComponent, camera: SceneObject | null, private hooks: OnboardingHooks) {
        this.camera = camera ?? global.scene.createSceneObject("OnboardingAnchor");
        // Draggable in Camera Object > UI Layout (designer panel).
        this.dialogAnchor = resolveAnchor(camera, UI_ANCHORS.dialog);
    }

    get isOpen(): boolean {
        return this.screen !== "none";
    }

    show(): void {
        if (this.isOpen) return;
        // The welcome hill stands in the room like the ritual's landscape,
        // and the first dialog arrives with it — no waiting beat.
        this.backdrop = buildBackdrop(this.camera);
        this.showIntro();
    }

    dismiss(): void {
        this.screen = "none";
        this.swapTo(null);
        if (this.backdrop) {
            this.backdrop.destroy();
            this.backdrop = null;
        }
    }

    private showIntro(): void {
        this.screen = "intro";
        this.swapTo(new RetroDialog(this.dialogAnchor, {
            name: "Intro",
            title: INTRO.title,
            headline: INTRO.headline,
            body: INTRO.body,
            // The welcome copy is the first thing anyone reads — it gets a
            // larger size than the shared dialog default, and the room for it.
            bodyTextSize: 52,
            bodyHeightCm: 20,
            widthCm: 58,
            buttons: [
                // Entering a task comes first: it is the path that works today,
                // and Todoist sync is still a later build. Both buttons start
                // a FRESH day — yesterday's stored tasks are cleared here, so
                // the typing list never opens pre-filled with leftovers.
                // ("Edit the list" from review routes back to showManual
                // directly and never re-clears what was just typed.)
                {
                    label: INTRO.manualButton,
                    caption: INTRO.manualCaption,
                    action: () => {
                        this.hooks.startFreshDay();
                        this.showManual();
                    },
                },
                {
                    label: INTRO.todoistButton,
                    caption: INTRO.todoistCaption,
                    action: () => {
                        this.hooks.startFreshDay();
                        this.hooks.status(INTRO.todoistComingSoon);
                        this.showManual();
                    },
                },
            ],
            sideBySide: true,
            onClose: () => this.dismiss(),
            icon: ICON_COMPUTER,
        }));
    }

    private showManual(): void {
        this.screen = "manual";
        this.swapTo(new RetroDialog(this.dialogAnchor, {
            name: "Manual",
            title: MANUAL_WINDOW.title,
            headline: MANUAL_WINDOW.headline,
            body: MANUAL_WINDOW.body,
            bodyHeightCm: 10,
            buttons: [
                {
                    label: MANUAL_WINDOW.typeButton,
                    caption: MANUAL_WINDOW.typeCaption,
                    action: () => this.showTyping(),
                },
                {
                    label: MANUAL_WINDOW.voiceButton,
                    caption: MANUAL_WINDOW.voiceCaption,
                    action: () => this.showVoice(),
                },
            ],
            footer: MANUAL_WINDOW.footer,
            onClose: () => this.dismiss(),
            icon: ICON_COMPUTER,
        }));
    }

    private showTyping(): void {
        this.hooks.openKeyboard();
        this.screen = "typing";
        this.swapTo(new RetroDialog(this.dialogAnchor, {
            name: "Typing",
            title: TYPING_WINDOW.title,
            headline: TYPING_WINDOW.headline,
            body: this.taskListing(),
            bodyHeightCm: 15,
            buttons: [
                // Add / remove share a row; "Bring them to life" finishes here.
                // The typing screen used to hand off to the review screen, which
                // repeated the same list and the same button for no gain.
                { label: TYPING_WINDOW.addAnother, action: () => this.hooks.openKeyboard(), column: "left" },
                {
                    label: TYPING_WINDOW.removeLast,
                    action: () => { if (this.hooks.removeLastTask()) this.notifyTaskAdded(); },
                    column: "right",
                },
                { label: TYPING_WINDOW.primary, action: () => this.finish() },
            ],
            onClose: () => this.dismiss(),
            icon: ICON_COMPUTER,
        }));
    }

    /** Live voice feedback, shown on the voice screen where it belongs. */
    setVoiceStatus(text: string): void {
        if (this.current && this.screen === "voice") this.current.setBody(text);
    }

    /**
     * A task was accepted while a screen is open — show it immediately.
     * Without this the typing screen kept its instructions and the user could
     * not tell whether anything had been captured.
     */
    notifyTaskAdded(): void {
        if (!this.current) return;
        if (this.screen === "typing" || this.screen === "voice") {
            this.current.setBody(this.taskListing());
        }
    }

    private taskListing(): string {
        const tasks = this.hooks.listTasks();
        if (!tasks.length) return TYPING_WINDOW.body;
        return tasks.map((text, index) => `${pad(index + 1)}  ${text}`).join("\n");
    }

    private showVoice(): void {
        this.screen = "voice";
        const dialog = new RetroDialog(this.dialogAnchor, {
            name: "Voice",
            title: VOICE_WINDOW.title,
            headline: VOICE_WINDOW.headline,
            body: VOICE_WINDOW.body,
            bodyHeightCm: 10,
            buttons: [
                {
                    label: VOICE_WINDOW.startButton,
                    caption: "Pause to finish a task; press again for the next one.",
                    action: () => {
                        dialog.setBody(VOICE_WINDOW.listening);
                        this.hooks.startVoice();
                    },
                },
                { label: VOICE_WINDOW.finishButton, action: () => this.showReview() },
            ],
            onClose: () => this.dismiss(),
            icon: ICON_COMPUTER,
        });
        this.swapTo(dialog);
    }

    private showReview(): void {
        const fromVoice = this.screen === "voice";
        this.screen = "review";
        const tasks = this.hooks.listTasks();
        const listing = tasks.length
            ? tasks.map((text) => `- ${text}`).join("\n")
            : "(nothing yet — go back and add one)";
        this.swapTo(new RetroDialog(this.dialogAnchor, {
            name: "Review",
            title: REVIEW_WINDOW.title,
            headline: fromVoice ? REVIEW_WINDOW.heardHeadline : REVIEW_WINDOW.headline,
            body: listing,
            bodyHeightCm: Math.min(20, 5 + tasks.length * 3),
            buttons: [
                { label: REVIEW_WINDOW.primary, action: () => this.finish() },
                { label: REVIEW_WINDOW.editButton, action: () => this.showManual() },
            ],
            footer: REVIEW_WINDOW.footer,
            onClose: () => this.dismiss(),
            icon: ICON_COMPUTER,
        }));
    }

    private finish(): void {
        this.dismiss();
        this.hooks.onFinished();
    }

    private swapTo(next: RetroDialog | null): void {
        if (this.current) this.current.destroy();
        this.current = next;
    }
}

/** Two-digit task numbering, matching the ADD TODAY'S TASKS mock. */
function pad(n: number): string {
    return n < 10 ? `0${n}` : `${n}`;
}
