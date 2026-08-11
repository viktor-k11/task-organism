import { BackPlate } from "SpectaclesUIKit.lspkg/Scripts/BackPlate";
import { Button } from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button";
import { FlexLayout } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout";
import { FlexItem } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem";
import { FlexAlign, FlexDirection, FlexJustify } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes";
import { Billboard } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Billboard/Billboard";
import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";
import { habitatLabel, selectionText } from "./TaskTextFormatting";
import { TASK_SELECTION_PANEL_Y_CM } from "../Config/CreatureConfig";

const PANEL_WIDTH = 38;

export class TaskSelectionView {
    private root: SceneObject;
    private panel: SceneObject;
    private habitatLabelObject: SceneObject;
    private habitatPlateObject: SceneObject;
    private habitatText: Text;
    private fullText: Text;
    private progressText: Text;

    constructor(parent: SceneObject, onLater: () => void) {
        this.root = global.scene.createSceneObject("TaskUIRoot");
        this.root.setParent(parent);
        this.root.getTransform().setLocalScale(vec3.one().uniformScale(1.3));
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
        this.habitatText = this.makeText(this.habitatLabelObject, 22, 3.4, 42);

        this.panel = global.scene.createSceneObject("TaskSelectionPanel");
        this.panel.setParent(this.root);
        this.panel.getTransform().setLocalPosition(new vec3(0, TASK_SELECTION_PANEL_Y_CM, 6));
        const plate = this.panel.createComponent(BackPlate.getTypeName()) as BackPlate;
        plate.size = new vec2(PANEL_WIDTH, 18);

        const content = global.scene.createSceneObject("Content");
        content.setParent(this.panel);
        content.getTransform().setLocalPosition(new vec3(0, 0, 0.6));
        const flex = content.createComponent(FlexLayout.getTypeName()) as FlexLayout;
        flex.autoDiscoverItemsOnStart = false;
        flex.width = PANEL_WIDTH - 4;
        flex.height = 16;
        flex.direction = FlexDirection.Column;
        flex.justifyContent = FlexJustify.Center;
        flex.alignItems = FlexAlign.Stretch;
        flex.rowGap = 0.7;

        this.fullText = this.addTextRow(content, flex, "FullTaskText", 6, 46);
        this.progressText = this.addTextRow(content, flex, "ResolveProgress", 4, 52);
        this.setProgress(0);

        const buttonObject = global.scene.createSceneObject("Later");
        buttonObject.setParent(content);
        const buttonItem = buttonObject.createComponent(FlexItem.getTypeName()) as FlexItem;
        buttonItem.overrideWidth = 11;
        buttonItem.overrideHeight = 4;
        const later = buttonObject.createComponent(Button.getTypeName()) as Button;
        later.size = new vec3(11, 4, 1);
        later.onTriggerUp.add(() => onLater());
        const labelObject = global.scene.createSceneObject("LaterLabel");
        labelObject.setParent(buttonObject);
        labelObject.getTransform().setLocalPosition(new vec3(0, 0, 0.08));
        const label = this.makeText(labelObject, 10.5, 3.5, 39);
        label.text = "Later";
        flex.addItems([buttonItem]);

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
        this.progressText.text = percent > 0 ? `HOLD  ${percent}%` : "HOLD AGAIN TO COMPLETE";
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
