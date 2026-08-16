import { BackPlate } from "SpectaclesUIKit.lspkg/Scripts/BackPlate";
import { Button } from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button";
import { BACKDROP_DISTANCE_CM, BACKDROP_HEIGHT_CM, BACKDROP_WIDTH_CM } from "../Config/CreatureConfig";
import { UI_TEXT_SIZE } from "./UiLayout";

/**
 * PLACEHOLDER retro-desktop dialog builder.
 *
 * Visual language: old-OS system dialogs — title bar, body copy, stacked
 * full-width buttons with small captions. Everything here is a stand-in for
 * the designer's real textures; the layout and wiring are what this file owns.
 * When the designed nine-slice frames arrive, they replace the BackPlate,
 * and nothing else changes.
 *
 * Button recipe follows the one known-good case in this scene (see
 * DemoControlView.buildStagingRow): full-width 30x5 buttons, stacked
 * vertically, standing z=2.0 proud of the plate. Small side-by-side buttons
 * are AVOIDED on purpose — they keep a default 20x20x20 collider and SIK can
 * never resolve which one a pinch meant.
 */

const segoe = requireAsset("../../Design assets/Fonts UI/Open Sans.ttf") as Font;
const segoeBold = requireAsset("../../Design assets/Fonts UI/Open Sans Bold.ttf") as Font;
/** Regular-weight mono, for document-style bodies (TODAY.TXT's aligned list). */
const courier = requireAsset("../../Design assets/Fonts UI/Cousine.ttf") as Font;
/** Cousine Bold (Courier-metric mono) — the same face baked into the "reminder" artwork, so
 *  every window title matches the reminder label. */
export const courierBold = requireAsset("../../Design assets/Fonts UI/Cousine Bold.ttf") as Font;

/**
 * Window and button artwork, authored as SVG in `Assets/Design assets/` and
 * converted to PNG. Edit the .svg and re-run the SVG-to-texture conversion to
 * restyle every dialog at once. Missing textures leave the plain UIKit look,
 * so a fresh clone still runs.
 */
let windowPanel: Texture | null = null;
let buttonPanel: Texture | null = null;
/** Title-bar icons, in the same pixel-art language as the window chrome. */
export let ICON_COMPUTER: Texture | null = null;
export let ICON_HOURGLASS: Texture | null = null;
let cursorTexture: Texture | null = null;
try {
    windowPanel = requireAsset("../../Design assets/WindowPanel_512x384.png") as Texture;
    buttonPanel = requireAsset("../../Design assets/ButtonPanel_256x64.png") as Texture;
    ICON_COMPUTER = requireAsset("../../Design assets/IconComputer_128x128.png") as Texture;
    ICON_HOURGLASS = requireAsset("../../Design assets/IconHourglass_128x128.png") as Texture;
    cursorTexture = requireAsset("../../Design assets/IconCursor_128x128.png") as Texture;
} catch (error) {
    print("[RetroUi] window/button artwork not found — using plain plates");
}
/** Unlit, texture-enabled, normal blend — the world-space artwork material.
 *  (The screen-space reminder panel uses the project's Image material instead;
 *  a screen material does not light correctly on a world-space quad.) */
const artworkMaterial = requireAsset("../../Materials/UiArtwork.mat") as Material;

/**
 * Hides a UIKit component's drawn mesh while leaving the component itself
 * alive. BackPlate's InteractionPlane is what SIK targets buttons through and
 * Button owns the collider and events — destroying either breaks input, so
 * only the VISUAL is switched off and our texture is drawn in its place.
 */
function hideVisual(object: SceneObject): void {
    const visual = object.getComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    if (visual) visual.enabled = false;
}

/**
 * Hides a component's mesh AND its UIKit child meshes.
 *
 * Used only for the close button, which has no artwork of its own to cover it.
 * Deliberately not used for plates and action buttons: recursing there made
 * every action button stop responding to pinches, and those already have
 * artwork drawn over them so the shallow hide is enough.
 */
function hideVisualDeep(object: SceneObject): void {
    hideVisual(object);
    const count = object.getChildrenCount();
    for (let i = 0; i < count; i++) hideVisualDeep(object.getChild(i));
}

/** Dresses a UIKit plate in the window artwork. No-op without the texture. */
export function applyWindowArtwork(object: SceneObject, size: vec2, z = 0.2): void {
    if (!windowPanel) return;
    hideVisual(object);
    addArtwork(object, windowPanel, size, z);
}

/** Dresses a UIKit button in the button artwork. No-op without the texture. */
export function applyButtonArtwork(object: SceneObject, size: vec2, z = 0.04): void {
    if (!buttonPanel) return;
    hideVisual(object);
    addArtwork(object, buttonPanel, size, z);
}

/** The artwork's title bar centre, as a fraction of the texture height —
 *  exported so other windows can seat their title in the same place. */
export const TITLE_BAR_CENTRE_FRACTION = 29 / 384;

/** A textured quad filling `size` cm, parented to `parent`. */
function addArtwork(parent: SceneObject, texture: Texture, size: vec2, z: number): void {
    const object = global.scene.createSceneObject("Artwork");
    object.setParent(parent);
    object.getTransform().setLocalPosition(new vec3(0, 0, z));
    object.getTransform().setLocalScale(new vec3(size.x, size.y, 1));
    const image = object.createComponent("Component.Image") as Image;
    image.mainMaterial = artworkMaterial.clone();
    image.mainPass.baseTex = texture;
}

/**
 * Dialogs are kept WIDE and SHORT on purpose. The window artwork is a 4:3
 * texture stretched to the dialog, so a tall narrow dialog stretches the
 * title bar and borders visibly — the taller the window, the fatter its
 * chrome. Widening the frame and tightening every vertical gap keeps real
 * dialogs near the texture's own proportions, where the stretch disappears.
 */
export const DIALOG_WIDTH_CM = 64;
const BUTTON_W = 34;
/** Width of each button when a dialog uses two columns. */
const COLUMN_W = 24;
/** The artwork's title bar, as fractions of the texture height (512x384). */
const TITLE_BAR_CENTRE = 29 / 384;
const TITLE_BAR_BOTTOM = 49 / 384;
/** Fractions of the texture that are chrome rather than usable body. */
const BODY_INSET_TOP = 56 / 384;
const BODY_INSET_BOTTOM = 10 / 384;
const BUTTON_H = 5;
const MARGIN = 2.2;
/** Gallery cell metrics: icon size and the label block under it. */
const GALLERY_ICON_CM = 8;
const GALLERY_LABEL_CM = 4.0;

export const RETRO = {
    ink: new vec4(1.0, 0.97, 0.92, 1),
    titleInk: new vec4(0.75, 0.85, 1.0, 1),
    dim: new vec4(0.85, 0.82, 0.78, 1),
    accent: new vec4(1.0, 0.85, 0.55, 1),
};

export interface DialogButtonSpec {
    label: string;
    caption?: string;
    action: () => void;
    /** Pair this button with the NEXT one on a single row. Mark the first
     *  "left" and the second "right"; anything unmarked stays full width. */
    column?: "left" | "right";
}

export interface DialogSpec {
    name: string;
    title: string;
    headline?: string;
    body?: string;
    bodyHeightCm?: number;
    /** Per-dialog body font size, when the shared default reads too small. */
    bodyTextSize?: number;
    /** Mono body — lines with padded columns stay aligned (TODAY.TXT). */
    bodyMono?: boolean;
    /** Body alignment; defaults to centred. */
    bodyAlign?: HorizontalAlignment;
    /** A row of icon-plus-label cells rendered between headline and body —
     *  TODAY.TXT's creatures: every icon on one line, its task underneath. */
    gallery?: { icon: Texture | null; label: string }[];
    /** A BOLD line (or two) rendered right after the gallery, before the
     *  body — TODAY.TXT's "N things are no longer yours to carry." */
    subheadline?: string;
    buttons: DialogButtonSpec[];
    /**
     * Lay two buttons out as columns (Ok / Cancel style) instead of stacked.
     * Only honoured for exactly two buttons. They stay wide — small buttons
     * keep a phantom 20-unit collider and SIK cannot tell them apart.
     */
    sideBySide?: boolean;
    /** Narrower buttons for dialogs where one wide slab looks heavy. */
    buttonWidthCm?: number;
    /** Override the frame width for dialogs that should not run full width. */
    widthCm?: number;
    /** One line rendered LARGE under the body — the ritual's countdown. */
    emphasis?: string;
    /** Makes the artwork's close box actually close the window. */
    onClose?: () => void;
    /** Pixel icon shown at the left of the title bar. */
    icon?: Texture | null;
    footer?: string;
}

export class RetroDialog {
    readonly root: SceneObject;
    private bodyText: Text | null = null;
    private emphasisText: Text | null = null;

    /** `parent` is normally an authored anchor from UI Layout (designer
     *  panel); localPosition is an extra offset from it, usually zero. */
    private width: number;

    constructor(parent: SceneObject, spec: DialogSpec, localPosition: vec3 = vec3.zero()) {
        this.root = global.scene.createSceneObject(`RetroDialog_${spec.name}`);
        this.root.setParent(parent);
        this.root.getTransform().setLocalPosition(localPosition);
        this.root.createComponent("Component.Canvas");
        this.width = spec.widthCm ?? DIALOG_WIDTH_CM;

        const bodyH = spec.bodyHeightCm ?? (spec.body ? 14 : 0);
        const headlineH = spec.headline ? 4.4 : 0;
        // Gallery: icon row + label row + breathing room.
        const galleryH = spec.gallery && spec.gallery.length ? GALLERY_ICON_CM + GALLERY_LABEL_CM + 1.2 : 0;
        const subheadlineH = spec.subheadline ? 6 : 0;
        const columns = spec.sideBySide === true && spec.buttons.length === 2;
        // A button marked "left" shares its row with the next one, so the
        // dialog is only as tall as the number of ROWS, not of buttons.
        let pairedRows = 0;
        for (let i = 0; i < spec.buttons.length; i++) {
            pairedRows++;
            if (spec.buttons[i].column === "left" && spec.buttons[i + 1]) i++;
        }
        const buttonRows = columns ? 1 : pairedRows;
        const buttonsH = buttonRows * (BUTTON_H + (this.hasCaptions(spec) ? 5.8 : 1.0));
        const footerH = spec.footer ? 3.0 : 0;
        const emphasisH = spec.emphasis ? 6 : 0;
        // BODY_INSET is how much of the texture is frame + title bar rather
        // than usable area (56/384 at the top, 10/384 at the bottom). Content
        // height must be grown by it or the last row lands on the border —
        // which is what pushed buttons and captions outside the window.
        const contentH = 3.2 + headlineH + galleryH + subheadlineH + bodyH + emphasisH + buttonsH + footerH;
        // Slim bottom: a full margin above AND below read as dead space.
        const height = (contentH + MARGIN + 1.2) / (1 - BODY_INSET_TOP - BODY_INSET_BOTTOM);
        const halfH = height / 2;

        // The plate's own Interactable stays ENABLED on purpose: the BackPlate
        // provides the InteractionPlane SIK uses to target elements standing
        // on it. Disabling it made every button on the dialog untargetable
        // (pinches timed out waiting for onTriggerStart).
        const plate = this.root.createComponent(BackPlate.getTypeName()) as BackPlate;
        // Must match the artwork: this plate's InteractionPlane is what SIK
        // targets the buttons through, so a plate wider than the window would
        // put the hit area in the wrong place.
        plate.size = new vec2(this.width, height);
        applyWindowArtwork(this.root, new vec2(this.width, height));

        // Title sits INSIDE the artwork's blue bar. Both constants are that
        // bar's centre and bottom as fractions of the texture's height, so the
        // label tracks the bar however tall the dialog turns out.
        const titleCentreY = halfH - height * TITLE_BAR_CENTRE;
        let y = titleCentreY;
        // The icon sits at the far left of the bar; the title starts after it.
        const iconSize = 3.6;
        const titleShift = spec.icon ? iconSize + 1.4 : 0;
        if (spec.icon) {
            const iconObject = global.scene.createSceneObject(`${spec.name}_Icon`);
            iconObject.setParent(this.root);
            iconObject.getTransform().setLocalPosition(new vec3(-this.width / 2 + 4.4, y, 0.9));
            iconObject.getTransform().setLocalScale(new vec3(iconSize, iconSize, 1));
            const iconImage = iconObject.createComponent("Component.Image") as Image;
            iconImage.mainMaterial = artworkMaterial.clone();
            iconImage.mainPass.baseTex = spec.icon;
        }
        this.makeText(`${spec.name}_Title`, spec.title, {
            y, x: -1.5 + titleShift / 2, width: this.width - 16 - titleShift, height: 4.6,
            size: UI_TEXT_SIZE.dialogTitle,
            align: HorizontalAlignment.Left, color: RETRO.ink, bold: true, mono: true,
        });
        // NO close box anywhere: the artwork's was removed from WindowPanel.svg
        // and no ✕ glyph is drawn. Every attempt to make one functional broke
        // the dialog (a UIKit Button anywhere on the window — 10 wide, 20 wide,
        // full title-bar width — stopped EVERY action button from receiving
        // pinches; small buttons keep a phantom 20x20x20 collider). A control
        // that looks pressable but does nothing is worse than none, so closing
        // stays on the window's own buttons, which all work.

        y = halfH - height * BODY_INSET_TOP - MARGIN;

        if (spec.headline) {
            y -= headlineH / 2;
            this.makeText(`${spec.name}_Headline`, spec.headline, {
                y, width: this.width - 6, height: headlineH, size: UI_TEXT_SIZE.dialogHeadline, color: RETRO.ink, bold: true,
            });
            y -= headlineH / 2;
        }

        if (spec.gallery && spec.gallery.length) {
            const count = spec.gallery.length;
            const cellW = Math.min(19, (this.width - 6) / count);
            const startX = -(cellW * (count - 1)) / 2;
            y -= GALLERY_ICON_CM / 2;
            for (let i = 0; i < count; i++) {
                const cell = spec.gallery[i];
                const x = startX + i * cellW;
                if (cell.icon) {
                    const iconObject = global.scene.createSceneObject(`${spec.name}_Gallery${i}`);
                    iconObject.setParent(this.root);
                    iconObject.getTransform().setLocalPosition(new vec3(x, y, 0.8));
                    iconObject.getTransform().setLocalScale(new vec3(GALLERY_ICON_CM, GALLERY_ICON_CM, 1));
                    const iconImage = iconObject.createComponent("Component.Image") as Image;
                    iconImage.mainMaterial = artworkMaterial.clone();
                    iconImage.mainPass.baseTex = cell.icon;
                }
                this.makeText(`${spec.name}_Gallery${i}_Label`, cell.label, {
                    y: y - GALLERY_ICON_CM / 2 - GALLERY_LABEL_CM / 2 - 0.3,
                    x, width: cellW - 1.2, height: GALLERY_LABEL_CM,
                    size: UI_TEXT_SIZE.dialogGalleryLabel, color: RETRO.ink,
                });
            }
            y -= GALLERY_ICON_CM / 2 + GALLERY_LABEL_CM + 1.2;
        }

        if (spec.subheadline) {
            y -= subheadlineH / 2;
            this.makeText(`${spec.name}_Subheadline`, spec.subheadline, {
                y, width: this.width - 8, height: subheadlineH,
                size: spec.bodyTextSize ?? UI_TEXT_SIZE.dialogBody,
                color: RETRO.ink, bold: true, mono: spec.bodyMono,
            });
            y -= subheadlineH / 2 + 0.4;
        }

        if (spec.body) {
            y -= bodyH / 2;
            this.bodyText = this.makeText(`${spec.name}_Body`, spec.body, {
                y, width: this.width - 8, height: bodyH,
                size: spec.bodyTextSize ?? UI_TEXT_SIZE.dialogBody,
                align: spec.bodyAlign, mono: spec.bodyMono, color: RETRO.ink,
            });
            y -= bodyH / 2 + 0.4;
        }

        if (spec.emphasis) {
            y -= emphasisH / 2;
            this.emphasisText = this.makeText(`${spec.name}_Emphasis`, spec.emphasis, {
                y, width: this.width - 8, height: emphasisH, size: UI_TEXT_SIZE.dialogEmphasis,
                color: RETRO.ink, bold: true,
            });
            y -= emphasisH / 2 + 0.4;
        }

        if (columns) {
            // Two columns, each still 22cm wide so the collider stays honest.
            y -= BUTTON_H / 2;
            const offsetX = COLUMN_W / 2 + 1.5;
            this.makeButton(spec.name, spec.buttons[0], y, -offsetX, COLUMN_W);
            this.makeButton(spec.name, spec.buttons[1], y, offsetX, COLUMN_W);
            y -= BUTTON_H / 2;
            if (this.hasCaptions(spec)) {
                y -= 2.2;
                for (let i = 0; i < 2; i++) {
                    const caption = spec.buttons[i].caption;
                    if (!caption) continue;
                    this.makeText(`${spec.name}_${spec.buttons[i].label}_Caption`, caption, {
                        y, x: i === 0 ? -offsetX : offsetX, width: COLUMN_W, height: 2.4,
                        size: UI_TEXT_SIZE.dialogCaption, color: RETRO.dim,
                    });
                }
                y -= 1.4;
            }
            y -= 1.0;
        } else {
            const fullWidth = spec.buttonWidthCm ?? BUTTON_W;
            for (let i = 0; i < spec.buttons.length; i++) {
                const buttonSpec = spec.buttons[i];
                const partner = buttonSpec.column === "left" ? spec.buttons[i + 1] : undefined;
                y -= BUTTON_H / 2;
                if (partner) {
                    const offsetX = COLUMN_W / 2 + 1.5;
                    this.makeButton(spec.name, buttonSpec, y, -offsetX, COLUMN_W);
                    this.makeButton(spec.name, partner, y, offsetX, COLUMN_W);
                    i++;
                } else {
                    this.makeButton(spec.name, buttonSpec, y, 0, fullWidth);
                }
                y -= BUTTON_H / 2;
                if (buttonSpec.caption) {
                    y -= 2.2;
                    this.makeText(`${spec.name}_${buttonSpec.label}_Caption`, buttonSpec.caption, {
                        y, width: this.width - 10, height: 2.4, size: UI_TEXT_SIZE.dialogCaption, color: RETRO.dim,
                    });
                    y -= 1.4;
                }
                y -= 1.0;
            }
        }

        if (spec.footer) {
            this.makeText(`${spec.name}_Footer`, spec.footer, {
                y: -halfH + height * BODY_INSET_BOTTOM + MARGIN, width: this.width - 8, height: 2.6, size: UI_TEXT_SIZE.dialogCaption, color: RETRO.dim,
            });
        }
    }

    setBody(text: string): void {
        if (this.bodyText) this.bodyText.text = text;
    }

    /** Updates the large line (the ritual's countdown). */
    setEmphasis(text: string): void {
        if (this.emphasisText) this.emphasisText.text = text;
    }

    setVisible(visible: boolean): void {
        this.root.enabled = visible;
    }

    destroy(): void {
        this.root.destroy();
    }

    private hasCaptions(spec: DialogSpec): boolean {
        return spec.buttons.some((candidate) => !!candidate.caption);
    }

    private makeButton(dialogName: string, spec: DialogButtonSpec, y: number, x = 0, width = BUTTON_W): void {
        const object = global.scene.createSceneObject(`${dialogName}_${spec.label}`);
        object.setParent(this.root);
        // Buttons must stand clear of the BackPlate's InteractionPlane collider
        // box or SIK resolves a pinch to the PLATE and the button's
        // onTriggerStart never fires (verified: at z=2.0 every button on a tall
        // dialog timed out; the staging panel hit the same wall). The taller the
        // plate, the thicker that box, so 5cm rather than the old 2cm.
        // z=12, not 5: a UIKit Button's collider is 20 units DEEP whatever
        // size you ask for (measured extents z=10), so at z=5 it swallowed the
        // plate's InteractionPlane behind it and SIK could not resolve which
        // one a pinch meant — every button on the window went dead. Standing
        // them this far proud clears the plate entirely.
        object.getTransform().setLocalPosition(new vec3(x, y, 12.0));
        const button = object.createComponent(Button.getTypeName()) as Button;
        button.size = new vec3(width, BUTTON_H, 1);
        button.onTriggerUp.add(spec.action);
        applyButtonArtwork(object, new vec2(width, BUTTON_H));

        const labelObject = global.scene.createSceneObject(`${dialogName}_${spec.label}_Label`);
        labelObject.setParent(object);
        labelObject.getTransform().setLocalPosition(new vec3(0, 0, 0.1));
        const text = labelObject.createComponent("Component.Text") as Text;
        text.depthTest = false;
        text.font = segoeBold;
        text.size = UI_TEXT_SIZE.dialogButton;
        text.horizontalAlignment = HorizontalAlignment.Center;
        text.verticalAlignment = VerticalAlignment.Center;
        text.horizontalOverflow = HorizontalOverflow.Shrink;
        text.layoutRect = Rect.create(-(width - 2) / 2, (width - 2) / 2, -2, 2);
        text.textFill.color = RETRO.ink;
        text.text = `[ ${spec.label} ]`;
    }

    private makeText(
        name: string,
        content: string,
        opts: { y: number; x?: number; width: number; height: number; size: number; align?: HorizontalAlignment; color: vec4; bold?: boolean; mono?: boolean },
    ): Text {
        const object = global.scene.createSceneObject(name);
        object.setParent(this.root);
        object.getTransform().setLocalPosition(new vec3(opts.x ?? 0, opts.y, 0.8));
        const text = object.createComponent("Component.Text") as Text;
        text.depthTest = false;
        text.font = opts.mono ? (opts.bold ? courierBold : courier) : opts.bold ? segoeBold : segoe;
        text.size = opts.size;
        text.horizontalAlignment = opts.align ?? HorizontalAlignment.Center;
        text.verticalAlignment = VerticalAlignment.Center;
        text.horizontalOverflow = HorizontalOverflow.Wrap;
        text.verticalOverflow = VerticalOverflow.Shrink;
        text.layoutRect = Rect.create(-opts.width / 2, opts.width / 2, -opts.height / 2, opts.height / 2);
        text.textFill.color = opts.color;
        text.text = content;
        return text;
    }
}

/** The nostalgic hill backdrop — an original generated image, not the
 *  copyrighted XP photo. Fills ~60% of the view at a comfortable 1.2m. */
export function buildBackdrop(camera: SceneObject | null, texture?: Texture): SceneObject {
    // A runtime-created Image has NO material (mainPass is null) — the texture
    // rides in on an authored unlit material instead, cloned so runtime never
    // mutates the shared asset.
    // WORLD-anchored at the user's current position and heading, NOT parented
    // to the camera: a head-locked backdrop moves with every head turn, so
    // turning never reveals more of it. Anchored in the world, the user can
    // look around the picture like a room. Same forward inversion and yaw
    // flattening as HabitatFloor (this project's camera reports inverted
    // forward, and head pitch at anchor time must not tilt the wall).
    const object = global.scene.createSceneObject("Backdrop");
    if (camera) {
        const camTransform = camera.getTransform();
        const camPos = camTransform.getWorldPosition();
        const camFwd = camTransform.forward.uniformScale(-1);
        const camYaw = Math.atan2(camFwd.x, -camFwd.z);
        const flatFwd = new vec3(Math.sin(camYaw), 0, -Math.cos(camYaw));
        object.getTransform().setWorldPosition(camPos.add(flatFwd.uniformScale(BACKDROP_DISTANCE_CM)));
        // NEGATIVE yaw: rotating the quad by +camYaw pointed its FRONT away
        // from the camera for any heading off world-north (the quad's normal
        // picks up +sin(yaw)·x while the look direction needs −sin(yaw)·x),
        // and backface culling made the whole picture invisible — the
        // "backdrop shows in some runs and not others" mystery. −camYaw
        // faces the front at the user for every heading; identity at yaw 0,
        // which is why the spawn pose always worked.
        object.getTransform().setWorldRotation(quat.angleAxis(-camYaw, vec3.up()));
    }
    const image = object.createComponent("Component.Image") as Image;
    if (texture) {
        image.mainMaterial = artworkMaterial.clone();
        image.mainPass.baseTex = texture;
    } else {
        // Default backdrop: the wide welcome hill.
        image.mainMaterial = artworkMaterial.clone();
        image.mainPass.baseTex = requireAsset("../../Generated Textures/WelcomeHillWide.png") as Texture;
    }
    // Belt-and-suspenders against any remaining facing edge case: a backdrop
    // drawn from its back side beats one that silently vanishes.
    image.mainPass.twoSided = true;
    // Wider than the display window on purpose — the hill runs past the edges
    // of vision like a desktop wallpaper rather than sitting in a frame.
    // Stretch, not the default fit/crop: enlarging the quad to surround the
    // view was cropping into the sky and losing the hill entirely. Stretch
    // keeps the whole picture visible at any size.
    image.stretchMode = StretchMode.Stretch;
    object.getTransform().setLocalScale(new vec3(BACKDROP_WIDTH_CM, BACKDROP_HEIGHT_CM, 1));
    return object;
}

/**
 * Reskins SIK's targeting cursor as the retro arrow.
 *
 * SIK spawns plain RenderMeshVisual quads named "CursorVisual" under
 * InteractorCursors at its own start, so this must run DELAYED (the
 * controller waits a second) and simply swaps each one's material for the
 * arrow texture. Returns how many it dressed; 0 means SIK had not spawned
 * them yet — harmless, the default ring stays.
 */
export function skinCursorVisuals(): number {
    if (!cursorTexture) return 0;
    let count = 0;
    const roots = global.scene.getRootObjectsCount();
    for (let i = 0; i < roots; i++) count += skinIn(global.scene.getRootObject(i));
    return count;
}

function skinIn(object: SceneObject): number {
    let count = 0;
    if (object.name === "CursorVisual") {
        const visual = object.getComponent("Component.RenderMeshVisual") as RenderMeshVisual;
        if (visual) {
            const material = artworkMaterial.clone();
            material.mainPass.baseTex = cursorTexture;
            visual.mainMaterial = material;
            count++;
        }
    }
    const children = object.getChildrenCount();
    for (let i = 0; i < children; i++) count += skinIn(object.getChild(i));
    return count;
}
