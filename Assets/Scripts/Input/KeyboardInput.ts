import { TaskRecord } from "../Data/TaskRecord";
import { TaskCreationService } from "./TaskCreationService";
import { TaskInputSource } from "./TaskInputSource";

export class KeyboardInput implements TaskInputSource {
    private currentText = "";
    private open = false;

    constructor(private creator: TaskCreationService) {}

    /**
     * True while the text keyboard has the user's typing.
     *
     * The controller's single-letter hotkeys (O, T, P, V, K, R) listen to the
     * SAME KeyPressEvent stream the keyboard types into, so without this guard
     * a task like "call THE dentist" opens TODAY.TXT twice and starts the
     * story on its way past the P. Verified by typing exactly that.
     */
    get isOpen(): boolean { return this.open; }

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
            this.open = false;
            global.textInputSystem.dismissKeyboard();
        };
        options.onKeyboardStateChanged = (isOpen: boolean) => { this.open = isOpen; };
        options.onError = (error: number, description: string) => {
            this.open = false;
            console.warn(`[KeyboardInput] ${error}: ${description}`);
        };
        this.open = true;
        global.textInputSystem.requestKeyboard(options);
    }
}
