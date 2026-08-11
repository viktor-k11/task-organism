import { TaskRecord } from "../Data/TaskRecord";
import { TaskCreationService } from "./TaskCreationService";
import { TaskInputSource } from "./TaskInputSource";

export class KeyboardInput implements TaskInputSource {
    private currentText = "";
    constructor(private creator: TaskCreationService) {}
    submit(text: string): TaskRecord | null { return this.creator.create(text); }

    show(): void {
        require("LensStudio:TextInputModule");
        const options = new TextInputSystem.KeyboardOptions();
        options.enablePreview = true;
        options.keyboardType = TextInputSystem.KeyboardType.Text;
        options.returnKeyType = TextInputSystem.ReturnKeyType.Done;
        options.onTextChanged = (text: string, _range: vec2) => { this.currentText = text; };
        options.onReturnKeyPressed = () => {
            this.submit(this.currentText);
            this.currentText = "";
            global.textInputSystem.dismissKeyboard();
        };
        options.onError = (error: number, description: string) => {
            console.warn(`[KeyboardInput] ${error}: ${description}`);
        };
        global.textInputSystem.requestKeyboard(options);
    }
}
