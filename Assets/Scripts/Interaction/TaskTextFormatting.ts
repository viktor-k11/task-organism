import { HABITAT_LABEL_MAX_CHARS, SELECTION_LINE_MAX_CHARS } from "../Config/CreatureConfig";

function ellipsis(text: string, maxChars: number): string {
    return text.length <= maxChars ? text : text.slice(0, Math.max(1, maxChars - 1)).trimEnd() + "…";
}

export function habitatLabel(text: string): string {
    return ellipsis(text.trim(), HABITAT_LABEL_MAX_CHARS);
}

/** Returns at most two bounded lines, breaking on spaces when practical. */
export function selectionText(text: string): string {
    let remaining = text.trim().replace(/\s+/g, " ");
    const lines: string[] = [];
    for (let lineIndex = 0; lineIndex < 2 && remaining.length > 0; lineIndex++) {
        if (remaining.length <= SELECTION_LINE_MAX_CHARS) {
            lines.push(remaining);
            remaining = "";
            break;
        }
        const candidate = remaining.slice(0, SELECTION_LINE_MAX_CHARS + 1);
        const breakAt = Math.max(candidate.lastIndexOf(" "), SELECTION_LINE_MAX_CHARS - 8);
        lines.push(remaining.slice(0, breakAt).trim());
        remaining = remaining.slice(breakAt).trim();
    }
    if (remaining.length > 0 && lines.length > 0) {
        const last = lines[lines.length - 1].slice(0, SELECTION_LINE_MAX_CHARS - 1).trimEnd();
        lines[lines.length - 1] = last + "…";
    }
    return lines.join("\n");
}
