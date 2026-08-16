import { BackPlate } from "SpectaclesUIKit.lspkg/Scripts/BackPlate";
import { DEMO_CLIP_MODE } from "../Config/CreatureConfig";
import { Button } from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button";

/**
 * Staging actions for placing the habitat before a recording. Buttons rather
 * than keyboard shortcuts on purpose: Lens Studio's Preview panel binds the
 * arrow keys, WASD and (verified by injection) plain letters like H to its own
 * camera fly controls, so any staging hotkey also flies the viewpoint it is
 * being used to frame. Buttons also work on device, where there is no keyboard.
 */
export interface StagingActions {
    onFurther(): void;
    onNearer(): void;
    onLeft(): void;
    onRight(): void;
    onRecenter(): void;
    /** Starts the scripted story. No-op if it is already running (start is
     *  idempotent), so this is safe to press at any time. */
    onPlay(): void;
}

/** The only judge-facing demo control. Raw inspector triggers stay hidden. */
export class DemoControlView {
    private root: SceneObject;
    private stagingPanel: SceneObject | null = null;
    private status: Text;
    private button: Button;
    private buttonLabel: Text;

    constructor(onAdvance: () => void, staging?: StagingActions) {
        const camera = this.findCamera();
        const root = global.scene.createSceneObject("WednesdayDemoControl");
        this.root = root;
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
        // Clip mode keeps the status text (content) and drops the operator
        // control (furniture).
        if (DEMO_CLIP_MODE) buttonObject.enabled = false;

        const labelObject = global.scene.createSceneObject("AdvanceDemoTimeLabel");
        labelObject.setParent(buttonObject);
        labelObject.getTransform().setLocalPosition(new vec3(0, 0, 0.1));
        this.buttonLabel = this.makeText(labelObject, 28, 4, 36);
        this.buttonLabel.text = "Advance Demo Time";

        if (staging) this.buildStagingRow(camera, staging);
    }

    /**
     * Staging panel: one full-width button per action, stacked, on its own
     * BackPlate below the main control.
     *
     * Full-width rows rather than a compact grid of small buttons because a
     * first attempt at a 5-button row did not work: the small buttons kept a
     * DEFAULT 20x20x20 collider (measured extents 10,10,10) instead of the
     * requested size, so all five overlapped and SIK could never resolve which
     * one a pinch meant — every targeted interaction timed out waiting for
     * onTriggerStart. This layout copies the proportions of the main
     * "Advance Demo Time" button, which is the one known-good case in this
     * scene (measured extents 15,2.5,0.5 matching its 30x5 size).
     *
     * Deliberately no collision or depth sensing — this only lets a human move
     * the habitat to a spot they can see is clear.
     */
    private buildStagingRow(camera: SceneObject | null, staging: StagingActions): void {
        const panel = global.scene.createSceneObject("WednesdayStagingControl");
        this.stagingPanel = panel;
        if (camera) panel.setParent(camera);
        if (DEMO_CLIP_MODE) { panel.enabled = false; return; }
        // Above centre, not below the main control. The main control already
        // sits at the bottom edge of the render region (measured: the display
        // spans roughly +/-30 units vertically at this 90cm distance), so a
        // panel stacked under it would be entirely off-screen and unpressable.
        // Its own InteractionPlane also obstructed pinches aimed at rows that
        // sat just beneath it.
        // Pushed back to 170cm and off to the left rather than sitting at the
        // main control's 90cm: at 90cm centred, the panel filled most of the
        // frame and hid the creatures it exists to position. Same physical
        // size, roughly half the angular footprint, clear of the habitat.
        panel.getTransform().setLocalPosition(new vec3(-24, 4, -170));
        panel.createComponent("Component.Canvas");
        const plate = panel.createComponent(BackPlate.getTypeName()) as BackPlate;
        plate.size = new vec2(42, 42);

        const rows = [
            { name: "Further", label: "Habitat further", action: staging.onFurther },
            { name: "Nearer", label: "Habitat nearer", action: staging.onNearer },
            { name: "Left", label: "Habitat left", action: staging.onLeft },
            { name: "Right", label: "Habitat right", action: staging.onRight },
            { name: "Recenter", label: "Recenter here", action: staging.onRecenter },
            { name: "Play", label: "Play story", action: staging.onPlay },
        ];
        let y = 16;
        for (const spec of rows) {
            const object = global.scene.createSceneObject(`Staging_${spec.name}`);
            object.setParent(panel);
            // 2.0 rather than the main control's 0.7: at 0.7 the BackPlate's
            // own InteractionPlaneColliderRoot sat between the camera and the
            // upper rows, and SIK rejected those pinches as "obstructed"
            // (lower rows happened to clear it). Standing the buttons further
            // proud of the plate removes the ambiguity for every row.
            object.getTransform().setLocalPosition(new vec3(0, y, 2.0));
            const button = object.createComponent(Button.getTypeName()) as Button;
            button.size = new vec3(30, 5, 1);
            button.onTriggerUp.add(spec.action);

            const labelObject = global.scene.createSceneObject(`Staging_${spec.name}_Label`);
            labelObject.setParent(object);
            labelObject.getTransform().setLocalPosition(new vec3(0, 0, 0.1));
            const text = this.makeText(labelObject, 28, 4, 30);
            text.text = spec.label;
            y -= 6.5;
        }
    }

    setStatus(text: string): void { this.status.text = text; }

    /** Hides the whole operator panel (development furniture) without
     *  disturbing any code that keeps pushing status text at it. */
    setPanelVisible(visible: boolean): void {
        this.root.enabled = visible;
        if (this.stagingPanel) this.stagingPanel.enabled = visible;
    }

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
