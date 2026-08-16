import { ART } from "../Config/ArtDirection";
import { BackPlate } from "SpectaclesUIKit.lspkg/Scripts/BackPlate";
import { Button } from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button";
import { FlexLayout } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout";
import { FlexItem } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem";
import { FlexAlign, FlexDirection, FlexJustify } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes";
import { Billboard } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Billboard/Billboard";
import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";
import { SELECTION_PANEL } from "../UI/UiCopy";
import { applyButtonArtwork, applyWindowArtwork, TITLE_BAR_CENTRE_FRACTION } from "../UI/RetroUi";
import { UI_TEXT_SIZE } from "../UI/UiLayout";
import { habitatLabel, selectionText } from "./TaskTextFormatting";


// Wider and shorter than before: the panel wears the same window artwork as
// the dialogs, and a tall narrow frame stretches that texture's title bar.
// Bigger overall so the copy is readable from habitat distance.
const PANEL_WIDTH = 56;
const PANEL_HEIGHT = 44;
const BUTTON_W = 30;
const BUTTON_H = 5;

/**
 * The panel actions. Care copy lives in UiCopy.SELECTION_PANEL.
 *
 * There is deliberately NO "mark as done" button: completing a task is the
 * emotional centre of the experience, and it should cost a deliberate,
 * held gesture rather than a tap you can make by accident.
 */
export interface SelectionActions {
    /** "Not yet" — snooze, close the panel, no consequence. */
    onLater(): void;
    /** "Give this one attention" — the creature comes and stays close. */
    onAttend(): void;
}

export class TaskSelectionView {
    private root: SceneObject;
    private panel: SceneObject;
    private habitatLabelObject: SceneObject;
    private habitatPlateObject: SceneObject;
    private habitatText: Text;
    private fullText: Text;
    private progressText: Text;

    constructor(parent: SceneObject, actions: SelectionActions, onUiPress?: () => void) {
        this.root = global.scene.createSceneObject("TaskUIRoot");
        this.root.setParent(parent);
        // The panel hangs on the creature at habitat distance (~2.4m), so it
        // needs real size to be readable — 1.3 was legible only up close.
        // Scaling the ROOT keeps frame, copy and buttons in proportion.
        this.root.getTransform().setLocalScale(vec3.one().uniformScale(2.0));
        this.root.createComponent("Component.Canvas");
        this.root.createComponent(Billboard.getTypeName());

        this.habitatPlateObject = global.scene.createSceneObject("HabitatLabelPlate");
        this.habitatPlateObject.setParent(this.root);
        this.habitatPlateObject.getTransform().setLocalPosition(new vec3(0, 23, 5.5));
        const habitatPlate = this.habitatPlateObject.createComponent(BackPlate.getTypeName()) as BackPlate;
        habitatPlate.size = new vec2(24, 4.2);
        const habitatPlateInteractable = this.habitatPlateObject.getComponent(Interactable.getTypeName()) as Interactable;
        if (habitatPlateInteractable) habitatPlateInteractable.enabled = false;

        this.habitatLabelObject = global.scene.createSceneObject("HabitatLabel");
        this.habitatLabelObject.setParent(this.root);
        this.habitatLabelObject.getTransform().setLocalPosition(new vec3(0, 23, 6));
        this.habitatText = this.makeText(this.habitatLabelObject, 22, 3.4, UI_TEXT_SIZE.creatureLabel);

        this.panel = global.scene.createSceneObject("TaskSelectionPanel");
        this.panel.setParent(this.root);
        this.panel.getTransform().setLocalPosition(new vec3(0, ART.selectionPanelYCm + 6, 6));
        const plate = this.panel.createComponent(BackPlate.getTypeName()) as BackPlate;
        plate.size = new vec2(PANEL_WIDTH, PANEL_HEIGHT);
        applyWindowArtwork(this.panel, new vec2(PANEL_WIDTH, PANEL_HEIGHT));

        // Title seated in the artwork's blue bar, matching every dialog.
        const titleObject = global.scene.createSceneObject("PanelTitle");
        titleObject.setParent(this.panel);
        titleObject.getTransform().setLocalPosition(
            new vec3(-1.5, PANEL_HEIGHT / 2 - PANEL_HEIGHT * TITLE_BAR_CENTRE_FRACTION, 0.8));
        const titleText = this.makeText(titleObject, PANEL_WIDTH - 14, 3.2, 30);
        titleText.text = SELECTION_PANEL.title;
        titleText.horizontalAlignment = HorizontalAlignment.Left;
        // Courier Bold — the same face as the "reminder" label and every title bar.
        titleText.font = requireAsset("../../Design assets/Fonts UI/Courier New Bold.ttf") as Font;
        // A pinch that starts on the open panel is a UI hit, not a miss. Without
        // this stamp the deselect-on-miss check (which only knows about creature
        // presses) closes the panel out from under the reader.
        const plateInteractable = this.panel.getComponent(Interactable.getTypeName()) as Interactable;
        if (plateInteractable && onUiPress) plateInteractable.onTriggerStart.add(() => onUiPress());

        const content = global.scene.createSceneObject("Content");
        content.setParent(this.panel);
        content.getTransform().setLocalPosition(new vec3(0, -3.5, 0.6));
        const flex = content.createComponent(FlexLayout.getTypeName()) as FlexLayout;
        flex.autoDiscoverItemsOnStart = false;
        flex.width = PANEL_WIDTH - 4;
        flex.height = PANEL_HEIGHT - 13;
        flex.direction = FlexDirection.Column;
        flex.justifyContent = FlexJustify.Center;
        flex.alignItems = FlexAlign.Stretch;
        flex.rowGap = 0.7;

        const headline = this.addTextRow(content, flex, "PanelHeadline", 4.0, UI_TEXT_SIZE.creaturePanelHeadline);
        headline.text = SELECTION_PANEL.headline;
        headline.textFill.color = new vec4(0.85, 0.82, 0.78, 1);
        this.fullText = this.addTextRow(content, flex, "FullTaskText", 7.5, UI_TEXT_SIZE.creaturePanelBody);
        this.addButton(content, flex, "Attend", SELECTION_PANEL.attendButton, actions.onAttend, onUiPress);
        this.addButton(content, flex, "Later", SELECTION_PANEL.laterButton, actions.onLater, onUiPress);
        this.progressText = this.addTextRow(content, flex, "ResolveProgress", 3.2, UI_TEXT_SIZE.creaturePanelProgress);
        this.setProgress(0);

        this.panel.enabled = false;
    }

    setTaskText(text: string): void {
        this.habitatText.text = habitatLabel(text);
        this.fullText.text = selectionText(text);
    }

    setSelected(selected: boolean): void {
        this.panel.enabled = selected;
        this.habitatPlateObject.enabled = !selected;
        this.habitatLabelObject.enabled = !selected;
        if (!selected) this.setProgress(0);
    }

    setProgress(progress01: number): void {
        const percent = Math.round(Math.max(0, Math.min(1, progress01)) * 100);
        this.progressText.text = percent > 0 ? `${SELECTION_PANEL.holdProgressPrefix}${percent}%` : SELECTION_PANEL.holdHint;
    }

    /**
     * Full-width stacked buttons on purpose — small side-by-side buttons keep
     * a default 20x20x20 collider and overlap (the staging panel lesson).
     * onTriggerDown stamps the UI press so the deferred miss-check cannot
     * deselect before onTriggerUp lands (see the Later-button race note in
     * the git history of this file).
     */
    private addButton(parent: SceneObject, flex: FlexLayout, name: string, label: string, action: () => void, onUiPress?: () => void): void {
        const buttonObject = global.scene.createSceneObject(name);
        buttonObject.setParent(parent);
        const buttonItem = buttonObject.createComponent(FlexItem.getTypeName()) as FlexItem;
        buttonItem.overrideWidth = BUTTON_W;
        buttonItem.overrideHeight = BUTTON_H;
        const button = buttonObject.createComponent(Button.getTypeName()) as Button;
        button.size = new vec3(BUTTON_W, BUTTON_H, 1);
        button.onTriggerUp.add(() => action());
        applyButtonArtwork(buttonObject, new vec2(BUTTON_W, BUTTON_H));
        // The "a pinch landed on UI, not on empty space" stamp must come from
        // the SIK Interactable's onTriggerStart, NOT the UIKit Button's
        // onTriggerDown: onTriggerDown does not fire reliably here, so the
        // deferred miss-check deselected the panel two frames into the press,
        // which disabled the button before its onTriggerUp could run — the
        // button looked dead and the task was never marked done.
        if (onUiPress) {
            const interactable = buttonObject.getComponent(Interactable.getTypeName()) as Interactable;
            if (interactable) interactable.onTriggerStart.add(() => onUiPress());
            button.onTriggerDown.add(() => onUiPress());
        }
        const labelObject = global.scene.createSceneObject(`${name}Label`);
        labelObject.setParent(buttonObject);
        labelObject.getTransform().setLocalPosition(new vec3(0, 0, 0.08));
        const text = this.makeText(labelObject, BUTTON_W - 2, 3.6, UI_TEXT_SIZE.creaturePanelButton);
        text.text = label;
        flex.addItems([buttonItem]);
    }

    private addTextRow(parent: SceneObject, flex: FlexLayout, name: string, height: number, size: number): Text {
        const row = global.scene.createSceneObject(name);
        row.setParent(parent);
        const item = row.createComponent(FlexItem.getTypeName()) as FlexItem;
        item.overrideWidth = PANEL_WIDTH - 4;
        item.overrideHeight = height;
        const text = this.makeText(row, PANEL_WIDTH - 4, height, size);
        flex.addItems([item]);
        return text;
    }

    private makeText(object: SceneObject, width: number, height: number, size: number): Text {
        const text = object.createComponent("Component.Text") as Text;
        text.depthTest = false;
        text.size = size;
        text.horizontalAlignment = HorizontalAlignment.Center;
        text.verticalAlignment = VerticalAlignment.Center;
        text.horizontalOverflow = HorizontalOverflow.Wrap;
        text.verticalOverflow = VerticalOverflow.Truncate;
        text.layoutRect = Rect.create(-width / 2, width / 2, -height / 2, height / 2);
        text.textFill.color = new vec4(1, 0.95, 0.9, 1);
        return text;
    }
}
