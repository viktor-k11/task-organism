#!/usr/bin/env node
/**
 * shader-param-audit.js — finds shader parameters that nothing writes.
 *
 * WHY THIS EXISTS
 * ---------------
 * This project has now had three silent failures in the .graphShader format,
 * none of which produced a compile error:
 *
 *   1. a graph edit rendered every creature body black
 *   2. hand-added parameters did not reach the material, so writes to them
 *      vanished
 *   3. a suspected third — an entire feature (the urgency halo) believed to be
 *      inert because no `mainPass.<name>` write could be found
 *
 * The third turned out to be a FALSE alarm, and the reason is the whole design
 * of this tool. The write existed as:
 *
 *     const pass = this.body.renderMeshVisual.mainMaterial.mainPass;
 *     pass.urgencyLevel = this.urgencyEased01;
 *
 * A grep for `mainPass.urgencyLevel` finds nothing, because the material pass
 * was held in a local called `pass`. Searching for the PREFIX is what produced
 * the false alarm. So this tool searches for the property NAME being assigned,
 * whatever the receiver is called.
 *
 * WHAT IT CANNOT DO
 * -----------------
 * It is static, so it proves a parameter has a writer — not that the writer
 * ever runs, nor that the value is non-zero when it matters. A parameter with a
 * writer can still be inert. It exists to catch the cheap half of the problem
 * cheaply; the expensive half still needs a capture.
 *
 * USAGE
 *   node Tools/shader-param-audit.js
 *
 * EXIT CODES
 *   0  every shader parameter has at least one writer
 *   1  at least one parameter has no writer
 *   2  bad environment (no shaders or no scripts found)
 */
"use strict";

const fs = require("fs");
const path = require("path");

const REPO = path.resolve(__dirname, "..");
const SHADER_DIRS = [path.join(REPO, "Assets")];
const SCRIPT_DIRS = [path.join(REPO, "Assets", "Scripts"), path.join(REPO, "Assets", "Tests")];

/**
 * Parameters that are deliberately unwritten. Keep this list short and always
 * say why — an entry here is a promise that the parameter is inert ON PURPOSE.
 */
const ALLOWED_UNWRITTEN = {
    // Lens Studio's own preview toggle, not ours to drive.
    PreviewEnabled: "Lens Studio built-in",
};

function walk(dir, test, out = []) {
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return out;
    }
    for (const e of entries) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, test, out);
        else if (test(p)) out.push(p);
    }
    return out;
}

/**
 * Removes comments before searching for writers.
 *
 * Found by breaking this tool on purpose: commenting out
 * `pass.urgencyLevel = ...` left the text `.urgencyLevel =` in the file, so the
 * audit still reported a writer and passed. A commented-out write is exactly
 * the case this is meant to catch — a parameter that used to be driven and
 * silently stopped being driven.
 *
 * Deliberately naive: it does not track strings or regex literals, so a `//`
 * inside a string could truncate a line. That is acceptable here — the cost is
 * a false FAIL, which someone investigates, rather than a false PASS, which
 * nobody sees.
 */
function stripComments(src) {
    return src
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .split("\n")
        .map((line) => line.replace(/\/\/.*$/, ""))
        .join("\n");
}

/** Pulls every `ScriptName: <name>` out of a .graphShader. That field is what
 *  becomes the material property, so it is the name TypeScript must assign. */
function parametersOf(shaderPath) {
    const text = fs.readFileSync(shaderPath, "utf8");
    const names = [];
    const re = /ScriptName:\s*\n\s*String:\s*(\S+)/g;
    let m;
    while ((m = re.exec(text)) !== null) {
        const name = m[1].replace(/^["']|["']$/g, "");
        if (name && !names.includes(name)) names.push(name);
    }
    return names;
}

function main() {
    const shaders = walk(SHADER_DIRS[0], (p) => p.endsWith(".graphShader"));
    if (shaders.length === 0) {
        console.error("no .graphShader files found");
        process.exit(2);
    }

    let scriptText = "";
    let scriptCount = 0;
    for (const dir of SCRIPT_DIRS) {
        for (const f of walk(dir, (p) => p.endsWith(".ts"))) {
            scriptText += stripComments(fs.readFileSync(f, "utf8")) + "\n";
            scriptCount++;
        }
    }
    if (scriptCount === 0) {
        console.error("no TypeScript sources found");
        process.exit(2);
    }

    const rows = [];
    let failed = false;

    for (const shader of shaders) {
        const rel = path.relative(REPO, shader);
        // unlit.graphShader is a shared Lens Studio template with hundreds of
        // parameters this project never drives. Auditing it would be all noise.
        if (path.basename(shader) === "unlit.graphShader") {
            rows.push({ shader: rel, name: "(skipped — shared LS template)", status: "skip" });
            continue;
        }
        for (const name of parametersOf(shader)) {
            if (ALLOWED_UNWRITTEN[name]) {
                rows.push({ shader: rel, name, status: "allowed", detail: ALLOWED_UNWRITTEN[name] });
                continue;
            }
            /* Match an assignment to the property on ANY receiver — `.name =` —
             * rather than `mainPass.name =`. The prefix form is exactly what
             * produced this project's false alarm. `==` and `===` are excluded
             * so a comparison is not mistaken for a write. */
            const assigned = new RegExp(`\\.${name}\\s*=(?!=)`).test(scriptText);
            if (assigned) {
                rows.push({ shader: rel, name, status: "written" });
            } else {
                rows.push({ shader: rel, name, status: "NO WRITER" });
                failed = true;
            }
        }
    }

    const width = Math.max(...rows.map((r) => r.name.length));
    console.log("");
    console.log("Shader parameter audit — every parameter should have a writer:");
    console.log("");
    let lastShader = null;
    for (const r of rows) {
        if (r.shader !== lastShader) {
            console.log(`  ${r.shader}`);
            lastShader = r.shader;
        }
        const mark = r.status === "NO WRITER" ? "FAIL" : r.status === "written" ? " ok " : "    ";
        console.log(`    ${mark}  ${r.name.padEnd(width)}  ${r.status}${r.detail ? " — " + r.detail : ""}`);
    }
    console.log("");
    if (failed) {
        console.log("FAIL — a parameter with no writer is almost certainly inert.");
        console.log("Either drive it from TypeScript, or add it to ALLOWED_UNWRITTEN with a reason.");
    } else {
        console.log("PASS — every shader parameter is assigned somewhere in TypeScript.");
        console.log("Note: static only. A parameter with a writer can still be inert if the");
        console.log("writer never runs — that half still needs a capture.");
    }
    console.log("");
    process.exit(failed ? 1 : 0);
}

main();
