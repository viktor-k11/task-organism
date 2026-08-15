import { ART } from "../Config/ArtDirection";

// Reads ART, not the raw constants. Importing the constants directly is what
// made the panel's two label sliders inert: they were published, copied into
// ART, and then bypassed here. A designer dragging a slider that does nothing
// learns to distrust the whole panel — worse than the missing feature, because
// selectionPanelYCm in the same group does work.

function ellipsis(text: string, maxChars: number): string {
    return text.length <= maxChars ? text : text.slice(0, Math.max(1, maxChars - 1)).trimEnd() + "…";
}

export function habitatLabel(text: string): string {
    return ellipsis(text.trim(), ART.habitatLabelMaxChars);
}

/** Returns at most two bounded lines, breaking on spaces when practical. */
export function selectionText(text: string): string {
    let remaining = text.trim().replace(/\s+/g, " ");
    const lines: string[] = [];
    for (let lineIndex = 0; lineIndex < 2 && remaining.length > 0; lineIndex++) {
        if (remaining.length <= ART.selectionLineMaxChars) {
            lines.push(remaining);
            remaining = "";
            break;
        }
        const candidate = remaining.slice(0, ART.selectionLineMaxChars + 1);
        const breakAt = Math.max(candidate.lastIndexOf(" "), ART.selectionLineMaxChars - 8);
        lines.push(remaining.slice(0, breakAt).trim());
        remaining = remaining.slice(breakAt).trim();
    }
    if (remaining.length > 0 && lines.length > 0) {
        const last = lines[lines.length - 1].slice(0, ART.selectionLineMaxChars - 1).trimEnd();
        lines[lines.length - 1] = last + "…";
    }
    return lines.join("\n");
}
