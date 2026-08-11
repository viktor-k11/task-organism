import { BackPlate } from "SpectaclesUIKit.lspkg/Scripts/BackPlate";
import { Button } from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button";

/** The only judge-facing demo control. Raw inspector triggers stay hidden. */
export class DemoControlView {
    private status: Text;
    private button: Button;
    private buttonLabel: Text;

    constructor(onAdvance: () => void) {
        const camera = this.findCamera();
        const root = global.scene.createSceneObject("WednesdayDemoControl");
        if (camera) root.setParent(camera);
        root.getTransform().setLocalPosition(new vec3(0, -26, -90));
        root.createComponent("Component.Canvas");

        const plate = root.createComponent(BackPlate.getTypeName()) as BackPlate;
        plate.size = new vec2(42, 13);

        const statusObject = global.scene.createSceneObject("DemoStatus");
        statusObject.setParent(root);
        statusObject.getTransform().setLocalPosition(new vec3(0, 3, 0.7));
        this.status = this.makeText(statusObject, 38, 4, 34);

        const buttonObject = global.scene.createSceneObject("AdvanceDemoTime");
        buttonObject.setParent(root);
        buttonObject.getTransform().setLocalPosition(new vec3(0, -2.5, 0.7));
        this.button = buttonObject.createComponent(Button.getTypeName()) as Button;
        this.button.size = new vec3(30, 5, 1);
        this.button.onTriggerUp.add(onAdvance);

        const labelObject = global.scene.createSceneObject("AdvanceDemoTimeLabel");
        labelObject.setParent(buttonObject);
        labelObject.getTransform().setLocalPosition(new vec3(0, 0, 0.1));
        this.buttonLabel = this.makeText(labelObject, 28, 4, 36);
        this.buttonLabel.text = "Advance Demo Time";
    }

    setStatus(text: string): void { this.status.text = text; }

    setAdvanced(advanced: boolean): void {
        this.buttonLabel.text = advanced ? "Time advanced" : "Advance Demo Time";
        this.button.enabled = !advanced;
    }

    private makeText(object: SceneObject, width: number, height: number, size: number): Text {
        const text = object.createComponent("Component.Text") as Text;
        text.depthTest = true;
        text.size = size;
        text.horizontalAlignment = HorizontalAlignment.Center;
        text.verticalAlignment = VerticalAlignment.Center;
        text.horizontalOverflow = HorizontalOverflow.Shrink;
        text.verticalOverflow = VerticalOverflow.Truncate;
        text.layoutRect = Rect.create(-width / 2, width / 2, -height / 2, height / 2);
        text.textFill.color = new vec4(1, 0.95, 0.9, 1);
        return text;
    }

    private findCamera(): SceneObject | null {
        const count = global.scene.getRootObjectsCount();
        for (let i = 0; i < count; i++) {
            const root = global.scene.getRootObject(i);
            if (root.name === "Camera Object") return root;
        }
        return null;
    }
}
