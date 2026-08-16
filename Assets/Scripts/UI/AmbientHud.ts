import { HUD, REMINDER_MESSAGES } from "./UiCopy";
import { RETRO } from "./RetroUi";
import { resolveScreenAnchor, UI_SCREEN_ANCHORS, UI_TEXT_SIZE } from "./UiLayout";

const segoe = requireAsset("../../Design assets/Fonts UI/Segoe UI.ttf") as Font;
const segoeBold = requireAsset("../../Design assets/Fonts UI/Segoe UI Bold.ttf") as Font;

/**
 * The designed reminder panel. The word "reminder" is part of the ARTWORK, so
 * no header text is drawn — the message alone sits inside the panel.
 *
 * Authored as `Assets/Design assets/ReminderPanel.svg` and converted to
 * `ReminderPanel_1024x384.png` — edit the SVG and re-run the SVG-to-texture
 * conversion to change the artwork. If the PNG is missing this stays null and
 * the message renders on its own, so a fresh clone still runs.
 */
let reminderPanel: Texture | null = null;
try {
    reminderPanel = requireAsset("../../Design assets/ReminderPanel_1024x384.png") as Texture;
} catch (error) {
    print("[AmbientHud] no ReminderPanel.png yet — reminder shows as bare text");
}

/**
 * Where the message sits INSIDE the panel artwork, as fractions of it
 * (-1 = left/bottom edge, 1 = right/top). The default clears the "reminder"
 * label in the upper-left of the supplied art; nudge these if the label moves.
 */
const PANEL_TEXT_INSET = { left: -0.90, right: 0.90, bottom: -0.82, top: 0.42 };

/** How long one creature-note + encouragement pairing stays up. */
const RESTING_ROTATE_S = 16;

/**
 * The reminder block fills only this fraction of its authored anchor, pinned
 * to the anchor's top-right corner — full size it competed with the headline
 * for attention. Resize the anchor itself for coarse moves; this is the
 * code-side trim on top of it.
 */
const REMINDER_SCALE = 0.66;

/**
 * The always-with-you text layer, drawn in SCREEN SPACE under
 * `Orthographic Camera > Full Frame Region`.
 *
 * Why screen space: the display FOV is 36.6 degrees, so world-space text
 * placed for a comfortable reading distance kept landing outside the visible
 * frame and getting cut. A ScreenTransform is defined in fractions of the
 * frame, so these can never fall off it.
 *
 * HIDDEN UNTIL THE WORLD IS LIVE — during onboarding the habitat is not on
 * stage yet, so a headline about carrying things would be talking about
 * nothing. TaskOrganismController calls setVisible(true) when onboarding ends.
 *
 * Nothing here is interactive: no colliders, so this layer can never steal a
 * pinch aimed at a creature.
 */
export class AmbientHud {
    private headlineGroup: SceneObject | null = null;
    private notifyGroup: SceneObject | null = null;
    private notifyTitle: Text | null = null;
    private notifyBody: Text | null = null;
    private attendingText: Text | null = null;
    private notifyRemainingS = 0;
    private visible = false;
    private queue: { title: string; body: string; seconds: number }[] = [];
    /** Seconds until the resting message rotates to the next pairing. */
    private restingRemainingS = 0;
    private nextReminder = 0;

    constructor() {
        const headlineAnchor = resolveScreenAnchor(UI_SCREEN_ANCHORS.hudHeadline);
        const notifyAnchor = resolveScreenAnchor(UI_SCREEN_ANCHORS.hudNotify);
        if (!headlineAnchor || !notifyAnchor) {
            console.warn("[AmbientHud] screen anchors missing under Full Frame Region — HUD disabled");
            return;
        }

        this.headlineGroup = headlineAnchor;
        this.makeText(headlineAnchor, "HudHeadline", HUD.headline, {
            top: 1, bottom: 0.35, size: UI_TEXT_SIZE.hudHeadline,
            color: RETRO.ink, bold: true, align: HorizontalAlignment.Center,
        });
        this.makeText(headlineAnchor, "HudSubheadline", HUD.subheadline, {
            top: 0.3, bottom: -0.25, size: UI_TEXT_SIZE.hudSubheadline,
            color: RETRO.dim, align: HorizontalAlignment.Center,
        });
        this.attendingText = this.makeText(headlineAnchor, "HudAttending", "", {
            top: -0.3, bottom: -1, size: UI_TEXT_SIZE.hudSubheadline,
            color: RETRO.accent, align: HorizontalAlignment.Center,
        });

        this.notifyGroup = notifyAnchor;
        // Everything in the block hangs off a scaled sub-anchor so the whole
        // reminder (panel + message) renders smaller than the authored anchor,
        // keeping its top-right corner where the designer put it.
        const notifyScaled = global.scene.createSceneObject("HudNotifyScaled");
        notifyScaled.setParent(notifyAnchor);
        notifyScaled.layer = notifyAnchor.layer;
        const scaledScreen = notifyScaled.createComponent("Component.ScreenTransform") as ScreenTransform;
        scaledScreen.anchors = Rect.create(1 - 2 * REMINDER_SCALE, 1, 1 - 2 * REMINDER_SCALE, 1);
        if (reminderPanel) this.makePanelImage(notifyScaled);
        // No header text: with the artwork in place the word "reminder" is
        // already drawn on it, and a second one underneath read as a mistake.
        // Without the artwork the message simply stands alone.
        this.notifyTitle = null;
        this.notifyBody = this.makeText(notifyScaled, "HudNotifyBody", "", {
            top: reminderPanel ? PANEL_TEXT_INSET.top : 1,
            bottom: reminderPanel ? PANEL_TEXT_INSET.bottom : -1,
            left: reminderPanel ? PANEL_TEXT_INSET.left : -1,
            right: reminderPanel ? PANEL_TEXT_INSET.right : 1,
            size: UI_TEXT_SIZE.hudNotifyBody,
            color: RETRO.ink,
            align: reminderPanel ? HorizontalAlignment.Left : HorizontalAlignment.Right,
        });

        this.setVisible(false);
    }

    /** The world is live (onboarding finished) — start speaking. */
    setVisible(visible: boolean): void {
        this.visible = visible;
        if (this.headlineGroup) this.headlineGroup.enabled = visible;
        if (!this.notifyGroup) return;
        if (visible) {
            // The block always has something gentle to say once the world is
            // live, so it opens on the resting message rather than empty.
            this.showResting();
        } else {
            this.notifyGroup.enabled = false;
        }
    }

    /** Queue a right-slot notification. Only one shows at a time — a calm
     *  experience never stacks system messages. */
    notify(title: string, body: string, seconds = 7): void {
        this.queue.push({ title, body, seconds });
    }

    /** Short untitled notification — the release toasts. */
    toast(body: string, seconds = 5): void {
        this.notify("", body, seconds);
    }

    setAttending(taskText: string | null): void {
        if (this.attendingText) this.attendingText.text = taskText ? `${HUD.attendingPrefix}${taskText}` : "";
    }

    update(dt: number): void {
        if (!this.visible || !this.notifyGroup || !this.notifyBody) return;

        // An event (chaser announcement, release toast) owns the slot until it
        // expires, then the resting message comes back.
        if (this.notifyRemainingS > 0) {
            this.notifyRemainingS -= dt;
            if (this.notifyRemainingS <= 0 && this.queue.length === 0) this.showResting();
            return;
        }
        const next = this.queue.shift();
        if (next) {
            // Event messages fold their header into the one text block, since
            // the panel artwork owns the heading area.
            if (this.notifyTitle) this.notifyTitle.text = next.title;
            this.notifyBody.text = this.notifyTitle || !next.title ? next.body : `${next.title}\n${next.body}`;
            this.notifyRemainingS = next.seconds;
            this.notifyGroup.enabled = true;
            return;
        }

        this.restingRemainingS -= dt;
        if (this.restingRemainingS <= 0) this.showResting();
    }

    /**
     * The slot's default state: the constant REMINDER header with one message
     * cycling underneath it. Replaces the old arrangement where a separate
     * floating note competed with this block for the same job.
     */
    private showResting(): void {
        if (!this.notifyGroup || !this.notifyBody) return;
        this.notifyRemainingS = 0;
        if (this.notifyTitle) this.notifyTitle.text = HUD.reminderTitle;
        this.notifyBody.text = REMINDER_MESSAGES[this.nextReminder % REMINDER_MESSAGES.length];
        this.nextReminder++;
        this.restingRemainingS = RESTING_ROTATE_S;
        this.notifyGroup.enabled = true;
    }

    /**
     * The designed reminder artwork, stretched to fill the anchor and sitting
     * behind the message. Created before the text so it renders underneath
     * (screen-space draw order follows hierarchy order).
     */
    private makePanelImage(parent: SceneObject): void {
        const object = global.scene.createSceneObject("ReminderPanel");
        object.setParent(parent);
        object.layer = parent.layer;
        const screen = object.createComponent("Component.ScreenTransform") as ScreenTransform;
        screen.anchors = Rect.create(-1, 1, -1, 1);
        const image = object.createComponent("Component.Image") as Image;
        // A runtime Image has no material of its own (mainPass would be null),
        // so it borrows the project's screen-space Image material.
        const material = requireAsset("../../Image.mat") as Material;
        image.mainMaterial = material.clone();
        image.mainPass.baseTex = reminderPanel;
    }

    /**
     * One screen-space text row. `top`/`bottom` are fractions of the parent
     * anchor's box (-1 bottom .. 1 top), so a row keeps its share of the
     * block no matter how the designer resizes the anchor.
     */
    private makeText(
        parent: SceneObject,
        name: string,
        content: string,
        opts: {
            top: number; bottom: number; size: number; color: vec4;
            bold?: boolean; align: HorizontalAlignment;
            left?: number; right?: number;
        },
    ): Text {
        const object = global.scene.createSceneObject(name);
        object.setParent(parent);
        // A runtime-created object lands on the DEFAULT layer, which the
        // orthographic camera does not render — inherit the anchor's layer or
        // the text is simply never drawn.
        object.layer = parent.layer;
        const screen = object.createComponent("Component.ScreenTransform") as ScreenTransform;
        // Assign the whole Rect: `anchors.left = x` can read back a copy and
        // silently do nothing. Rect.create order is (left, right, bottom, top).
        screen.anchors = Rect.create(opts.left ?? -1, opts.right ?? 1, opts.bottom, opts.top);

        const text = object.createComponent("Component.Text") as Text;
        text.font = opts.bold ? segoeBold : segoe;
        text.size = opts.size;
        text.horizontalAlignment = opts.align;
        text.verticalAlignment = VerticalAlignment.Center;
        text.horizontalOverflow = HorizontalOverflow.Wrap;
        text.verticalOverflow = VerticalOverflow.Shrink;
        text.textFill.color = opts.color;
        text.text = content;
        return text;
    }
}
