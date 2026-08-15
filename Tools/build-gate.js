#!/usr/bin/env node
/**
 * build-gate.js — the one command that says whether this build is healthy.
 *
 *   node Tools/build-gate.js
 *
 * Four stages, one report, one exit code:
 *
 *   1. compile   TypeScript across the whole project
 *   2. leaf      all registered LEAF scenarios
 *   3. golden    seven-frame golden-image diff
 *   4. perf      release-frame max at six creatures vs a recorded threshold
 *
 * WHY NO npm DEPENDENCIES
 * -----------------------
 * Same reasoning as Tools/visual-regression.js, and it is not a style
 * preference. The reader is a designer opening this on a Friday. A gate that
 * opens with `npm install` is a gate that does not get run, and an unrun gate
 * is worth less than no gate because it looks like coverage. Everything here is
 * node stdlib plus two binaries that are already on the machine: `sips` (ships
 * with macOS) and Lens Studio's own `lensifyts` compiler.
 *
 * WHY TWO OF THE FOUR STAGES READ ARTIFACTS INSTEAD OF DRIVING LENS STUDIO
 * ------------------------------------------------------------------------
 * Stages 2 and 4, and the capture half of stage 3, need a running Lens. The
 * only sanctioned way to reach Lens Studio in this project is the MCP tools,
 * and AGENTS.md forbids in as many words reaching the editor over raw HTTP —
 * the ban exists because hand-rolled HTTP against that endpoint fails silently.
 * MCP tools exist only inside an agent session, so a standalone node script
 * cannot call them. Pretending otherwise would mean shipping the one thing the
 * project explicitly prohibits.
 *
 * So the split is the same one visual-regression.js already made: the half that
 * needs the editor is driven by an agent (`--plan` prints the exact sequence),
 * and the half anyone can run unattended is this script. What makes it a gate
 * rather than a filing cabinet is FRESHNESS — an editor-produced artifact older
 * than the newest source file is STALE and fails. A green verdict from stale
 * evidence is the specific failure this design exists to prevent.
 *
 * USAGE
 *   node Tools/build-gate.js                       full gate
 *   node Tools/build-gate.js --offline             only stages needing no editor
 *   node Tools/build-gate.js --plan                print the agent/MCP sequence
 *   node Tools/build-gate.js --stage compile       run one stage
 *
 * EXIT CODES
 *   0  every stage passed
 *   1  at least one stage failed, was stale, or was missing
 *   2  bad usage or a broken environment (no compiler, no candidate dir)
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");

const REPO = path.resolve(__dirname, "..");
const EVIDENCE_DIR = path.join(REPO, ".build-gate");

/* ------------------------------------------------------------------ *
 * Everything tunable lives here — project convention is one config
 * block, not constants scattered through the logic.
 * ------------------------------------------------------------------ */
const CONFIG = {
    /** Lens Studio's bundled compiler. Not on PATH, so it is located rather
     *  than assumed; see findCompiler() for the search order. */
    compilerRelPath: "Contents/Plugins/Es_TypeScriptCompilationManager.bundle/lensifyts",
    tsconfig: path.join(REPO, "tsconfig.json"),

    /** Every scenario the LEAF index is expected to register. Listed rather
     *  than counted so that a scenario silently dropping out of LeafIndex.ts
     *  is a FAILURE and not a smaller, still-green run. This project has been
     *  bitten twice by tests that passed while a path never ran (gate4 and
     *  gate5 exist because of exactly that), so "all of them ran" is itself an
     *  assertion worth making. */
    expectedScenarios: [
        "task-organism-data-layer",
        "gate2-1-4-chaser-lifecycle",
        "gate2-5-persistence-seed",
        "gate2-5-persistence-restore",
        "gate2-6-8-elapsed-clock",
        "gate2-7-resolve-idempotency",
        "gate3-input-parity",
        "gate3-short-pinch-select",
        "gate3-early-hold-cancel",
        "gate3-completed-hold",
        "gate3-no-gesture-conflict",
        "gate3-later-snooze",
        "gate4-controller-survives-release",
        "gate5-snooze-runtime-path",
        // Gate 6 drives the real input path — a pinch SIK resolves against the
        // real collider. These are the only scenarios that can see a collider
        // or targeting defect; everything above calls pressStart directly.
        "gate6-pinch-select",
        "gate6-pinch-hold-resolve",
        "gate6-pinch-early-release",
        "gate6-pinch-miss",
        "gate6-moving-chaser",
    ],

    /** Share of pixels that may differ before a frame counts as changed.
     *  Matches visual-regression.js's own default. */
    goldenTolerancePct: 1.0,

    /** Frame count is owned by visual-regression.js (EXPECTED_FRAMES); this is
     *  only for the summary line. */
    expectedFrameCount: 7,

    /**
     * Release-frame budget at six creatures, in milliseconds.
     *
     * History, because a bare number is not reviewable: the release frame cost
     * 551ms when play() built a mesh and created 30 SceneObjects in one frame.
     * Pooling that work into prewarm() took the Perfetto-measured release frame
     * to 224ms. This gate measures the same event a different way — the max
     * frame delta in the 12 frames after a release, reported by PerfGateProbe —
     * so the threshold is set from what THAT probe actually observes, not from
     * the Perfetto number, which is a different instrument.
     *
     * See PERF_BASELINE below for the observed value this was set against.
     */
    perfReleaseFrameMaxMs: 300,

    /** The run must exercise the six-creature case; that is where the spike
     *  was found. A four-creature capture is not evidence about six. */
    perfMinCreatures: 6,

    /** Source tree whose mtimes decide whether editor evidence is stale. */
    sourceGlobRoots: [path.join(REPO, "Assets", "Scripts")],
};

/** Recorded so a threshold change is always visible next to what it replaced. */
const PERF_BASELINE = {
    perfettoBeforePoolingMs: 551.3,
    perfettoAfterPoolingMs: 223.7,
    /* Still null: the probe has not yet been run against a responsive editor.
     * The 300ms budget is therefore set from the Perfetto figure plus headroom,
     * not from this instrument — which is a provisional threshold, not a
     * measured one. Record the observed value here on the first clean capture
     * and tighten the budget to match. See HANDOFF-VISUAL.md §8. */
    probeObservedMs: null,
};

/* ------------------------------------------------------------------ *
 * Small helpers
 * ------------------------------------------------------------------ */

const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");

function fmtMs(n) {
    return `${n.toFixed(1)}ms`;
}

/** Staleness is often seconds, not minutes — "0 min" reads like a rounding bug
 *  rather than a real finding, so say it in whatever unit is honest. */
function humanGap(ms) {
    const s = Math.round(ms / 1000);
    if (s < 90) return `${s}s`;
    const m = Math.round(s / 60);
    if (m < 90) return `${m} min`;
    return `${Math.round(m / 60)}h`;
}

/** Newest mtime under the source roots — the clock that editor evidence is
 *  judged against. */
function newestSourceMtime() {
    let newest = 0;
    const walk = (dir) => {
        let entries;
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const e of entries) {
            const p = path.join(dir, e.name);
            if (e.isDirectory()) walk(p);
            else if (e.name.endsWith(".ts")) {
                const m = fs.statSync(p).mtimeMs;
                if (m > newest) newest = m;
            }
        }
    };
    for (const root of CONFIG.sourceGlobRoots) walk(root);
    return newest;
}

/**
 * Reads an agent-produced evidence file and rejects it if it predates the
 * newest source edit. Returns { ok, data, reason }.
 */
function readEvidence(name) {
    const file = path.join(EVIDENCE_DIR, name);
    if (!fs.existsSync(file)) {
        return {
            ok: false,
            reason: `missing — no ${path.relative(REPO, file)}. Run: node Tools/build-gate.js --plan`,
        };
    }
    let data;
    try {
        data = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (e) {
        return { ok: false, reason: `unreadable (${e.message})`, artifact: file };
    }
    const stamp = fs.statSync(file).mtimeMs;
    const newest = newestSourceMtime();
    if (stamp < newest) {
        return {
            ok: false,
            stale: true,
            artifact: file,
            reason: `captured ${humanGap(newest - stamp)} before the newest source edit — recapture: node Tools/build-gate.js --plan`,
        };
    }
    return { ok: true, data, artifact: file };
}

/* ------------------------------------------------------------------ *
 * Stage 1 — TypeScript compile
 * ------------------------------------------------------------------ */

/** Lens Studio is not always in /Applications — on this machine it lives on the
 *  Desktop. Search the likely roots, then fall back to the running process. */
function findCompiler() {
    const candidates = [
        "/Applications/Lens Studio.app",
        path.join(process.env.HOME || "", "Desktop", "Lens Studio.app"),
        path.join(process.env.HOME || "", "Applications", "Lens Studio.app"),
    ];
    for (const app of candidates) {
        const p = path.join(app, CONFIG.compilerRelPath);
        if (fs.existsSync(p)) return p;
    }
    // Last resort: ask the OS where a running Lens Studio came from.
    try {
        const out = execFileSync("/bin/ps", ["-Ao", "command"], { encoding: "utf8" });
        const line = out.split("\n").find((l) => l.includes("Lens Studio.app/Contents/MacOS/Lens Studio"));
        if (line) {
            const app = line.slice(0, line.indexOf(".app") + 4);
            const p = path.join(app, CONFIG.compilerRelPath);
            if (fs.existsSync(p)) return p;
        }
    } catch {
        /* ignore */
    }
    return null;
}

function stageCompile() {
    const compiler = findCompiler();
    if (!compiler) {
        return {
            name: "compile",
            status: "ENV",
            detail: "could not find Lens Studio's lensifyts compiler",
            hint: "Install Lens Studio 5.22+, or edit CONFIG.compilerRelPath.",
        };
    }

    let out;
    try {
        out = execFileSync(compiler, ["tsc-only", "--tsconfig", CONFIG.tsconfig], {
            cwd: REPO,
            encoding: "utf8",
            maxBuffer: 32 * 1024 * 1024,
        });
    } catch (e) {
        // Non-zero exit still carries the diagnostics we want to report.
        out = `${e.stdout || ""}${e.stderr || ""}`;
    }

    const clean = stripAnsi(out);

    /* lensifyts EXITS 0 EVEN WITH COMPILE ERRORS — verified on this project.
     * Trusting the exit code here would let a broken build through the gate,
     * which is the single most expensive way this script could be wrong. The
     * diagnostics are parsed out of stdout instead. The ANSI strip above is
     * load-bearing: the raw output writes "error" and "TS2307" separated by
     * colour escapes, so a naive /error TS/ match finds nothing. */
    const errorLines = clean
        .split("\n")
        .filter((l) => /error TS\d+/.test(l))
        .map((l) => l.trim());

    const compiled = /Compilation finished/.test(clean);
    if (!compiled) {
        return {
            name: "compile",
            status: "ENV",
            detail: "compiler produced no completion line — it may have crashed",
            hint: "Run it by hand: " + compiler + " tsc-only --tsconfig tsconfig.json",
        };
    }

    if (errorLines.length === 0) {
        return { name: "compile", status: "PASS", detail: "0 errors" };
    }

    const files = [...new Set(errorLines.map((l) => l.split("(")[0].split(":")[0]))];
    return {
        name: "compile",
        status: "FAIL",
        detail: `${errorLines.length} error(s) in ${files.length} file(s)`,
        lines: errorLines.slice(0, 8),
        hint: `First offender: ${files[0]}`,
    };
}

/* ------------------------------------------------------------------ *
 * Stage 2 — LEAF scenarios
 * ------------------------------------------------------------------ */

function stageLeaf() {
    const ev = readEvidence("leaf.json");
    if (!ev.ok) {
        return { name: "leaf", status: ev.stale ? "STALE" : "MISSING", detail: ev.reason, artifact: ev.artifact };
    }

    const results = Array.isArray(ev.data.results) ? ev.data.results : [];
    const byId = new Map(results.map((r) => [r.id, r]));

    const missing = CONFIG.expectedScenarios.filter((id) => !byId.has(id));
    const unexpected = results.map((r) => r.id).filter((id) => !CONFIG.expectedScenarios.includes(id));
    const failed = results.filter((r) => String(r.status).toLowerCase() !== "pass");

    // Retries are reported, never hidden. A scenario that needed two goes at
    // the MCP bridge still passed, but the reader deserves to know it was flaky
    // — gate3-early-hold-cancel has timed out twice in this project's history.
    const retried = results.filter((r) => (r.invocations || 1) > 1);

    const parts = [`${results.length}/${CONFIG.expectedScenarios.length} ran`];
    if (retried.length) {
        parts.push(`${retried.length} needed a retry (${retried.map((r) => `${r.id}×${r.invocations}`).join(", ")})`);
    }

    if (missing.length || unexpected.length || failed.length) {
        const why = [];
        if (failed.length) why.push(`${failed.length} failed: ${failed.map((r) => r.id).join(", ")}`);
        if (missing.length) why.push(`${missing.length} never ran: ${missing.join(", ")}`);
        if (unexpected.length) why.push(`${unexpected.length} unknown to this gate: ${unexpected.join(", ")}`);
        return {
            name: "leaf",
            status: "FAIL",
            detail: parts.join("; "),
            lines: why,
            artifact: ev.artifact,
            hint: "Scenario detail is in .build-gate/leaf.json; rerun one with run_leaf_scenario.",
        };
    }

    return { name: "leaf", status: "PASS", detail: parts.join("; ") };
}

/* ------------------------------------------------------------------ *
 * Stage 3 — golden-image diff
 * ------------------------------------------------------------------ */

function stageGolden() {
    const candidate = path.join(EVIDENCE_DIR, "candidate");
    if (!fs.existsSync(candidate)) {
        return {
            name: "golden",
            status: "MISSING",
            detail: `no captures at ${path.relative(REPO, candidate)}`,
            hint: "Capture the seven frames: node Tools/build-gate.js --plan",
        };
    }

    // Freshness is judged on the capture directory, same rule as the JSON
    // evidence: frames older than the newest source edit are not evidence
    // about this build.
    const newest = newestSourceMtime();
    const frameStamps = fs
        .readdirSync(candidate)
        .filter((f) => f.endsWith(".png"))
        .map((f) => fs.statSync(path.join(candidate, f)).mtimeMs);
    if (frameStamps.length && Math.max(...frameStamps) < newest) {
        const gap = humanGap(newest - Math.max(...frameStamps));
        return {
            name: "golden",
            status: "STALE",
            detail: `captures are ${gap} older than the newest source edit`,
            artifact: candidate,
            hint: "Recapture: node Tools/build-gate.js --plan",
        };
    }

    // Delegate to the existing differ rather than reimplementing it. It already
    // knows the frame list, the BMP decode and the two metrics.
    const differ = path.join(REPO, "Tools", "visual-regression.js");
    const run = spawnSync(process.execPath, [differ, "--candidate", candidate, "--tolerance", String(CONFIG.goldenTolerancePct)], {
        cwd: REPO,
        encoding: "utf8",
    });

    const out = `${run.stdout || ""}${run.stderr || ""}`;
    const frameLines = out
        .split("\n")
        .filter((l) => /^\s{2}\d\d-/.test(l))
        .map((l) => l.trim());
    const bad = frameLines.filter((l) => !/\sok\s/.test(l));

    if (run.status === 0) {
        return { name: "golden", status: "PASS", detail: `${frameLines.length}/7 frames within ${CONFIG.goldenTolerancePct}%` };
    }
    if (run.status === 2) {
        return {
            name: "golden",
            status: "ENV",
            detail: out.trim().split("\n")[0] || "differ could not run",
            hint: `Run it directly: node Tools/visual-regression.js --candidate ${path.relative(REPO, candidate)}`,
        };
    }
    /* A frame that never got written and a frame that changed are different
     * problems with different fixes — recapture vs. look at the picture — so
     * the summary line must not blur them into "N frames moved". A half-failed
     * capture batch is the more likely of the two, and the one that wastes the
     * most time when misreported. */
    const missing = bad.filter((l) => /MISSING CAPTURE|NO GOLDEN/.test(l));
    const moved = bad.filter((l) => !/MISSING CAPTURE|NO GOLDEN/.test(l));

    const summary = [];
    if (moved.length) summary.push(`${moved.length} frame(s) changed`);
    if (missing.length) summary.push(`${missing.length} frame(s) never captured`);

    return {
        name: "golden",
        status: "FAIL",
        detail: summary.join(", ") + ` of ${CONFIG.expectedFrameCount}`,
        lines: bad,
        artifact: candidate,
        hint: missing.length
            ? "The capture batch did not complete — recapture: node Tools/build-gate.js --plan"
            : `Compare by eye: open ${path.relative(REPO, candidate)}/<frame>.png against docs/golden/<frame>.png`,
    };
}

/* ------------------------------------------------------------------ *
 * Stage 4 — release-frame perf
 * ------------------------------------------------------------------ */

function stagePerf() {
    const ev = readEvidence("perf.json");
    if (!ev.ok) {
        return { name: "perf", status: ev.stale ? "STALE" : "MISSING", detail: ev.reason, artifact: ev.artifact };
    }

    const releases = Array.isArray(ev.data.releases) ? ev.data.releases : [];
    if (releases.length === 0) {
        return {
            name: "perf",
            status: "FAIL",
            detail: "no releases recorded — the run never completed a task",
            artifact: ev.artifact,
            hint: "Expect [PerfGate] release=… lines in the log. If absent, the demo did not reach a release.",
        };
    }

    const creatures = Math.max(...releases.map((r) => r.creatures || 0));
    if (creatures < CONFIG.perfMinCreatures) {
        return {
            name: "perf",
            status: "FAIL",
            detail: `captured at ${creatures} creatures, needs ${CONFIG.perfMinCreatures}`,
            artifact: ev.artifact,
            hint: "Set DEMO_TASK_COUNT = 6 in CreatureConfig.ts and recapture.",
        };
    }

    const worst = releases.reduce((a, b) => (b.maxFrameMs > a.maxFrameMs ? b : a));
    const over = worst.maxFrameMs > CONFIG.perfReleaseFrameMaxMs;
    const detail =
        `worst release frame ${fmtMs(worst.maxFrameMs)} ` +
        `(release ${worst.index} of ${releases.length}, ${creatures} creatures) ` +
        `vs budget ${fmtMs(CONFIG.perfReleaseFrameMaxMs)}`;

    if (!over) return { name: "perf", status: "PASS", detail };

    return {
        name: "perf",
        status: "FAIL",
        detail,
        artifact: ev.artifact,
        lines: releases.map((r) => `release=${r.index} creatures=${r.creatures} maxFrameMs=${fmtMs(r.maxFrameMs)}`),
        hint:
            "The release effect is likely constructing again instead of using the pool. " +
            "Check for a '[ReleaseEffect] pool MISSING' line, and that reset() still does not clear the pool.",
    };
}

/* ------------------------------------------------------------------ *
 * The agent half — printed, not executed
 * ------------------------------------------------------------------ */

function printPlan() {
    console.log(`
Capture plan — the half that needs a running Lens Studio.
Hand this to Claude (or any agent with the Lens Studio MCP tools). It cannot be
run from this script: AGENTS.md forbids reaching the editor over raw HTTP, and
MCP tools exist only inside an agent session.

  mkdir -p .build-gate/candidate     # do this FIRST, explicitly.
                                     # The capture tool reports success and
                                     # writes nothing when the directory is
                                     # missing. A whole batch was lost to it.

STAGE 2 — LEAF (${CONFIG.expectedScenarios.length} scenarios)
  For each id below:
    run_leaf_scenario  { scenarioId: "<id>", onDevice: false }
  On an MCP timeout: retry ONCE, and record invocations: 2 for that scenario.
  Do not hide the retry — the gate prints it.
  Write .build-gate/leaf.json:
    { "ranAt": <epoch ms>,
      "results": [ { "id": "...", "status": "pass", "invocations": 1 }, ... ] }

  Scenarios:
${CONFIG.expectedScenarios.map((s) => `    ${s}`).join("\n")}

STAGE 3 — golden frames (7)
  For frame index 0..6:
    1. Set VISUAL_HARNESS_FRAME in Assets/Scripts/Config/CreatureConfig.ts
    2. RecompileTypeScriptTool
    3. RunAndCollectLogsTool { mode: "refresh" }
       ^ MUST be this. The Preview panel's own refresh does NOT reset the Lens;
         use it and you capture the frozen end of the previous run.
    4. Wait for "[VisualHarness] frame=<name> READY"
    5. Screenshot to .build-gate/candidate/<name>.png
  Set VISUAL_HARNESS_FRAME back to -1 when done.

STAGE 4 — release-frame perf at ${CONFIG.perfMinCreatures} creatures
  1. Confirm DEMO_TASK_COUNT = ${CONFIG.perfMinCreatures} in CreatureConfig.ts
  2. RunAndCollectLogsTool { mode: "refresh", settleMaxMs: 40000, timeoutMs: 30000 }
     Let the demo run through both completions.
  3. Parse every "[PerfGate] release=N creatures=C maxFrameMs=X" line.
  4. Write .build-gate/perf.json:
     { "ranAt": <epoch ms>,
       "releases": [ { "index": 1, "creatures": 6, "maxFrameMs": 223.7 }, ... ] }

Then run:  node Tools/build-gate.js
`);
}

/* ------------------------------------------------------------------ *
 * Report
 * ------------------------------------------------------------------ */

const STATUS_ORDER = { PASS: 0, FAIL: 1, STALE: 1, MISSING: 1, ENV: 2, SKIP: 0 };

function report(stages, offline) {
    const label = {
        compile: "1. TypeScript compile",
        leaf: "2. LEAF scenarios",
        golden: "3. Golden images",
        perf: "4. Release-frame perf",
    };

    const worst = stages.reduce((acc, s) => Math.max(acc, STATUS_ORDER[s.status] ?? 1), 0);
    const anyBlocking = stages.some((s) => s.status !== "PASS" && s.status !== "SKIP");
    const skipped = stages.filter((s) => s.status === "SKIP");

    let verdict;
    if (worst === 2) verdict = "BROKEN ENVIRONMENT — the gate could not judge this build";
    else if (anyBlocking) verdict = "FAIL";
    else if (skipped.length) verdict = `PARTIAL — ${stages.length - skipped.length}/${stages.length} stages ran`;
    else verdict = "PASS";

    const bar = "─".repeat(64);
    console.log("");
    console.log(bar);
    console.log(`  BUILD GATE: ${verdict}`);
    console.log(bar);
    console.log("");

    for (const s of stages) {
        const mark =
            s.status === "PASS" ? "  ok  " : s.status === "SKIP" ? " skip " : s.status === "ENV" ? " env  " : " FAIL ";
        console.log(`${mark} ${label[s.name].padEnd(24)} ${s.status.padEnd(8)} ${s.detail}`);
        for (const l of s.lines || []) console.log(`        ${l}`);
        if (s.hint && s.status !== "PASS" && s.status !== "SKIP") console.log(`        -> ${s.hint}`);
        if (s.artifact && s.status !== "PASS" && s.status !== "SKIP") {
            console.log(`        -> artifact: ${path.relative(REPO, s.artifact)}`);
        }
    }

    console.log("");
    if (offline && skipped.length) {
        console.log("Offline run: the editor-driven stages were skipped, not passed.");
        console.log("A PARTIAL verdict is not a healthy build — run the full gate before shipping.");
        console.log("");
    }
    if (verdict === "PASS") {
        console.log("Every stage passed against evidence newer than the last source edit.");
    }
    console.log("");

    return verdict === "PASS" ? 0 : worst === 2 ? 2 : 1;
}

/* ------------------------------------------------------------------ *
 * main
 * ------------------------------------------------------------------ */

function main() {
    const argv = process.argv.slice(2);
    if (argv.includes("--help") || argv.includes("-h")) {
        console.log(fs.readFileSync(__filename, "utf8").split("*/")[0].replace(/^\/\*\*?/, ""));
        process.exit(0);
    }
    if (argv.includes("--plan")) {
        printPlan();
        process.exit(0);
    }

    const offline = argv.includes("--offline");
    const only = argv.includes("--stage") ? argv[argv.indexOf("--stage") + 1] : null;

    const runners = [
        { name: "compile", fn: stageCompile, needsEditor: false },
        { name: "leaf", fn: stageLeaf, needsEditor: true },
        { name: "golden", fn: stageGolden, needsEditor: true },
        { name: "perf", fn: stagePerf, needsEditor: true },
    ];

    if (only && !runners.some((r) => r.name === only)) {
        console.error(`unknown stage: ${only} (expected one of ${runners.map((r) => r.name).join(", ")})`);
        process.exit(2);
    }

    const stages = [];
    for (const r of runners) {
        if (only && r.name !== only) continue;
        if (offline && r.needsEditor) {
            stages.push({ name: r.name, status: "SKIP", detail: "needs a running Lens Studio (--offline)" });
            continue;
        }
        // Progress only on a real terminal. The compile stage takes ~15s and
        // silence there reads as a hang; but piped into a file or a CI log the
        // carriage returns just make noise.
        const tty = process.stderr.isTTY;
        if (tty) process.stderr.write(`  … ${r.name}\r`);
        stages.push(r.fn());
        if (tty) process.stderr.write(`${" ".repeat(40)}\r`);
    }

    process.exit(report(stages, offline));
}

main();
