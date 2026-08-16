/**
 * Designer-editable placement for the UI layer.
 *
 * HOW TO MOVE ANY UI ELEMENT BY HAND
 * ----------------------------------
 * In the Scene Hierarchy open `Camera Object > UI Layout (designer panel)`.
 * Each child is an empty anchor; drag it in the Scene panel (or type numbers
 * into its Transform) and the matching UI attaches itself there at runtime.
 * Nothing in code overwrites those values.
 *
 *   BackdropAnchor      the onboarding hill image
 *   DialogAnchor        every system-message window
 *   HudHeadlineAnchor   "What are you carrying today?" + its subline
 *   HudNotifyAnchor     the right-hand system notifications
 *
 * The ambient text (headline block and notification block) is SCREEN space,
 * not world space — see UI_SCREEN_ANCHORS below. These world anchors cover
 * the backdrop and the dialogs.
 *
 * Deleting an anchor is safe: the code falls back to the position baked in
 * here, which is also what a fresh clone of the project uses.
 *
 * FONT SIZES live in UI_TEXT_SIZE below — one number per element, all in one
 * place, same spirit as CreatureConfig for the creatures.
 */

export const UI_ANCHORS = {
    backdrop: { name: "BackdropAnchor", fallback: new vec3(0, 0, -125) },
    dialog: { name: "DialogAnchor", fallback: new vec3(0, 0, -120) },
    hudHeadline: { name: "HudHeadlineAnchor", fallback: new vec3(-13, 20, -90) },
    hudNotify: { name: "HudNotifyAnchor", fallback: new vec3(13, 20, -90) },
};

/** Every font size in the UI layer. Bigger number = bigger text. */
export const UI_TEXT_SIZE = {
    dialogTitle: 48,
    dialogHeadline: 44,
    dialogBody: 40,
    dialogButton: 32,
    dialogCaption: 26,
    /** Task text under each creature icon on TODAY.TXT. */
    dialogGalleryLabel: 34,
    /** The one big line a dialog may show — the ritual countdown. */
    dialogEmphasis: 92,
    hudHeadline: 30,
    hudSubheadline: 24,
    hudNotifyTitle: 28,
    hudNotifyBody: 18,
    creatureLabel: 46,
    creaturePanelHeadline: 44,
    creaturePanelBody: 62,
    creaturePanelButton: 46,
    creaturePanelProgress: 36,
};

/**
 * SCREEN-SPACE anchors, under `Orthographic Camera > Full Frame Region`.
 *
 * These are the ambient messages — the headline block and the notification
 * block (a creature's note with a reinforcing line under it). They live in
 * screen space
 * rather than in the world because world-space text kept falling outside the
 * display: the SPECS camera FOV is 36.6 degrees (measured from the Camera
 * component), so at 2.3m only about +/-69cm is ever on screen and the notes
 * sat past it. A ScreenTransform cannot fall off the display by construction.
 *
 * To move one: select it under Full Frame Region and edit its Screen
 * Transform anchors (they run -1..1, left/bottom to right/top), or drag it
 * in the Scene panel.
 */
export const UI_SCREEN_ANCHORS = {
    hudHeadline: "HudHeadlineScreen",
    /** REMINDER header + the rotating message; also used by event messages. */
    hudNotify: "HudNotifyScreen",
};

const SCREEN_REGION_NAME = "Full Frame Region";
const LAYOUT_ROOT_NAME = "UI Layout (designer panel)";

/**
 * Finds a screen-space anchor by name anywhere under the orthographic
 * camera's Full Frame Region. Returns null when the project has none — the
 * caller then falls back to its world-space placement, so a fresh clone
 * without the authored screen layer still runs.
 */
export function resolveScreenAnchor(name: string): SceneObject | null {
    const count = global.scene.getRootObjectsCount();
    for (let i = 0; i < count; i++) {
        const root = global.scene.getRootObject(i);
        const region = findDescendant(root, SCREEN_REGION_NAME);
        if (!region) continue;
        const anchor = findChild(region, name);
        if (anchor) return anchor;
    }
    return null;
}

function findDescendant(parent: SceneObject, name: string): SceneObject | null {
    if (parent.name === name) return parent;
    const count = parent.getChildrenCount();
    for (let i = 0; i < count; i++) {
        const found = findDescendant(parent.getChild(i), name);
        if (found) return found;
    }
    return null;
}

/**
 * Finds an authored anchor under the layout root and returns it, or creates a
 * stand-in at the fallback position when the project has no anchor authored
 * (fresh clone, or the designer deleted it).
 */
export function resolveAnchor(
    camera: SceneObject | null,
    anchor: { name: string; fallback: vec3 },
): SceneObject {
    const root = camera ? findChild(camera, LAYOUT_ROOT_NAME) : null;
    const authored = root ? findChild(root, anchor.name) : null;
    if (authored) return authored;

    const standIn = global.scene.createSceneObject(anchor.name);
    if (camera) standIn.setParent(camera);
    standIn.getTransform().setLocalPosition(anchor.fallback);
    return standIn;
}

function findChild(parent: SceneObject, name: string): SceneObject | null {
    const count = parent.getChildrenCount();
    for (let i = 0; i < count; i++) {
        const child = parent.getChild(i);
        if (child.name === name) return child;
    }
    return null;
}
