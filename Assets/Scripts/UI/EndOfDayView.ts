import { NOTE_TEMPLATES, TODAY_TXT } from "./UiCopy";
import { ICON_COMPUTER, RetroDialog } from "./RetroUi";
import { resolveAnchor, UI_ANCHORS } from "./UiLayout";

export interface CompletedEntry {
    text: string;
    species: string;
}

/**
 * Pixel icon per species, in the same retro language as the window icons.
 * Authored as `Assets/Design assets/Icon<Species>.svg` and converted to
 * 128x128 PNGs. Any missing icon leaves its cell as label-only, so a fresh
 * clone without the artwork still runs.
 */
const SPECIES_ICONS: { [species: string]: Texture | null } = {
    dog: null, cat: null, owl: null, elephant: null, rabbit: null, penguin: null,
};
try {
    SPECIES_ICONS.dog = requireAsset("../../Design assets/IconDog_128x128.png") as Texture;
    SPECIES_ICONS.cat = requireAsset("../../Design assets/IconCat_128x128.png") as Texture;
    SPECIES_ICONS.owl = requireAsset("../../Design assets/IconOwl_128x128.png") as Texture;
    SPECIES_ICONS.elephant = requireAsset("../../Design assets/IconElephant_128x128.png") as Texture;
    SPECIES_ICONS.rabbit = requireAsset("../../Design assets/IconRabbit_128x128.png") as Texture;
    SPECIES_ICONS.penguin = requireAsset("../../Design assets/IconPenguin_128x128.png") as Texture;
} catch (error) {
    print("[EndOfDayView] species icons missing — TODAY.TXT shows labels only");
}

/**
 * TODAY.TXT — the end-of-day document. Opened by a button/key, never
 * automatically: closing the day is the user's gesture, not the system's.
 *
 * The "A NOTE ABOUT TODAY" section currently comes from pattern-matched
 * templates (see pickNote). The AI evaluator replaces pickNote's RESULT with
 * a model-written reflection under the same tone contract — quiet noticing,
 * a low-pressure closer, never cheerleading. Swapping template for model
 * changes one function, not this view.
 */
export class EndOfDayView {
    private dialog: RetroDialog | null = null;
    /** Set by the controller so TODAY.TXT can offer the closing ritual. */
    private onRitual: (() => void) | null = null;

    constructor(private camera: SceneObject | null) {}

    setRitualHandler(handler: () => void): void {
        this.onRitual = handler;
    }

    get isOpen(): boolean {
        return this.dialog !== null;
    }

    toggle(completions: CompletedEntry[]): void {
        if (this.dialog) {
            this.close();
        } else {
            this.open(completions);
        }
    }

    open(completions: CompletedEntry[]): void {
        this.close();
        const body = this.composeBody(completions);
        this.dialog = new RetroDialog(resolveAnchor(this.camera, UI_ANCHORS.dialog), {
            name: "TodayTxt",
            title: TODAY_TXT.title,
            headline: TODAY_TXT.headline,
            // The creatures cared for today: icons in one row, each task under
            // its icon. The body below carries only the summary and the note.
            gallery: completions.slice(0, 6).map((entry) => ({
                icon: SPECIES_ICONS[entry.species] ?? null,
                label: entry.text,
            })),
            // The carried-count line leads, BOLD, right under the icons.
            subheadline: completions.length ? this.composeCarried(completions) : undefined,
            body,
            // Document treatment: mono like the .txt it claims to be, and well
            // above the dialog default — this summary is read from a distance.
            bodyTextSize: 56,
            bodyMono: true,
            bodyHeightCm: completions.length ? 11 : 8,
            buttons: this.onRitual
                ? [
                    // Offered, never forced — the ritual is opt-in.
                    { label: TODAY_TXT.ritualButton, action: () => { this.close(); if (this.onRitual) this.onRitual(); } },
                    { label: TODAY_TXT.closeButton, action: () => this.close() },
                ]
                : [{ label: TODAY_TXT.closeButton, action: () => this.close() }],
            footer: TODAY_TXT.footer,
            onClose: () => this.close(),
            icon: ICON_COMPUTER,
        });
    }

    close(): void {
        if (this.dialog) {
            this.dialog.destroy();
            this.dialog = null;
        }
    }

    /** The bold lead line: "N things are no longer yours to carry." */
    private composeCarried(completions: CompletedEntry[]): string {
        const carried =
            completions.length === 1
                ? `1${TODAY_TXT.carriedSuffixOne}`
                : `${completions.length}${TODAY_TXT.carriedSuffix}`;
        return `${carried}\n${TODAY_TXT.enough}`;
    }

    private composeBody(completions: CompletedEntry[]): string {
        if (completions.length === 0) return TODAY_TXT.emptyBody;
        // Creature/task pairs live in the icon gallery and the carried count
        // in the bold subheadline — the body is only the note.
        return `${TODAY_TXT.noteTitle}\n${pickNote(completions)}`;
    }
}

/**
 * Template-tier evaluator: buckets the day by simple keyword patterns.
 * The AI tier calls a model with the task list and the tone rules from
 * UiCopy, and returns the same shape of string.
 */
export function pickNote(completions: CompletedEntry[]): string {
    const joined = completions.map((entry) => entry.text.toLowerCase()).join(" ");
    const creative = /present|slide|deck|design|write|draft|research|note|sketch|edit/.test(joined);
    const people = /reply|answer|email|call|message|send|invite|meet|help/.test(joined);
    if (creative) return NOTE_TEMPLATES.creative;
    if (people) return NOTE_TEMPLATES.people;
    return NOTE_TEMPLATES.practical;
}
