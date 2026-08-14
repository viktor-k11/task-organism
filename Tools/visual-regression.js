#!/usr/bin/env node
/**
 * visual-regression.js — compares a candidate set of golden frames against the
 * committed set in docs/golden/ and reports which frames changed, and by how
 * much.
 *
 * WHY NO npm DEPENDENCIES
 * -----------------------
 * The person this exists for is a designer opening the project on a Friday. A
 * harness that starts with "first run npm install" is a harness that does not
 * get run. PNGs are decoded by shelling out to `sips`, which ships with macOS,
 * converting to uncompressed 24-bit BMP — a format simple enough to parse in
 * forty lines. No node_modules, no lockfile, no network.
 *
 * WHAT IT DOES NOT DO
 * -------------------
 * It does not capture. Capture needs the Lens Studio MCP tools, which are only
 * available to an agent session — and this project's AGENTS.md explicitly
 * forbids reaching the editor over raw HTTP. So the capture half is a documented
 * procedure (see HANDOFF-VISUAL.md) and this half is the part anyone can run
 * unattended.
 *
 * USAGE
 *   node Tools/visual-regression.js --candidate <dir>
 *   node Tools/visual-regression.js --candidate <dir> --update   # accept as new golden
 *   node Tools/visual-regression.js --candidate <dir> --tolerance 1.5
 *
 * EXIT CODES
 *   0  every frame within tolerance
 *   1  at least one frame changed beyond tolerance, or a frame is missing
 *   2  bad usage / environment problem
 */
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");

const REPO = path.resolve(__dirname, "..");
const GOLDEN_DIR = path.join(REPO, "docs", "golden");

/** Frame names must match VISUAL_HARNESS_FRAMES in TaskOrganismController.ts.
 *  Listed here rather than globbed so a MISSING frame is an error instead of
 *  silently passing — a capture batch that half-failed is exactly the kind of
 *  thing this harness exists to catch. */
const EXPECTED_FRAMES = [
    "01-calm-habitat",
    "02-urgency",
    "03-approach",
    "04-selection-panel",
    "05-hold-50pct",
    "06-release",
    "07-post-release",
];

function parseArgs(argv) {
    const args = { candidate: null, golden: GOLDEN_DIR, tolerance: 1.0, update: false };
    for (let i = 2; i < argv.length; i++) {
        const a = argv[i];
        if (a === "--candidate") args.candidate = argv[++i];
        else if (a === "--golden") args.golden = argv[++i];
        else if (a === "--tolerance") args.tolerance = parseFloat(argv[++i]);
        else if (a === "--update") args.update = true;
        else { console.error(`unknown argument: ${a}`); process.exit(2); }
    }
    return args;
}

/** PNG -> uncompressed 24-bit BMP via macOS `sips`, then parse. */
function readPixels(pngPath, tmpDir) {
    const bmpPath = path.join(tmpDir, path.basename(pngPath).replace(/\.png$/i, "") + ".bmp");
    try {
        execFileSync("sips", ["-s", "format", "bmp", pngPath, "--out", bmpPath], { stdio: "ignore" });
    } catch (e) {
        throw new Error(`sips failed on ${pngPath} — is this macOS? (${e.message})`);
    }
    const buf = fs.readFileSync(bmpPath);
    if (buf.length < 54 || buf[0] !== 0x42 || buf[1] !== 0x4d) throw new Error(`not a BMP: ${bmpPath}`);
    const dataOffset = buf.readUInt32LE(10);
    const width = buf.readInt32LE(18);
    const heightRaw = buf.readInt32LE(22);
    const height = Math.abs(heightRaw);
    const bpp = buf.readUInt16LE(28);
    if (bpp !== 24 && bpp !== 32) throw new Error(`unsupported BMP depth ${bpp} in ${bmpPath}`);
    const bytesPerPx = bpp / 8;
    const rowSize = Math.floor((bpp * width + 31) / 32) * 4; // rows pad to 4 bytes
    const px = Buffer.alloc(width * height * 3);
    for (let y = 0; y < height; y++) {
        // BMP rows are bottom-up unless height is negative.
        const srcY = heightRaw > 0 ? height - 1 - y : y;
        let src = dataOffset + srcY * rowSize;
        let dst = y * width * 3;
        for (let x = 0; x < width; x++) {
            px[dst] = buf[src + 2];      // BMP stores BGR
            px[dst + 1] = buf[src + 1];
            px[dst + 2] = buf[src];
            src += bytesPerPx;
            dst += 3;
        }
    }
    return { width, height, px };
}

/**
 * Two numbers, because they answer different questions.
 *   meanDelta    — average per-channel difference over the whole frame. Catches
 *                  a global shift (palette, exposure, the whole habitat moving).
 *   changedPct   — share of pixels differing by more than a per-channel noise
 *                  floor. Catches a small but real change (one creature's feet
 *                  sinking) that a whole-frame mean would dilute to nothing.
 */
function compare(a, b, noiseFloor = 6) {
    if (a.width !== b.width || a.height !== b.height) return null;
    let sum = 0;
    let changed = 0;
    const n = a.width * a.height;
    for (let i = 0; i < n; i++) {
        const o = i * 3;
        const dr = Math.abs(a.px[o] - b.px[o]);
        const dg = Math.abs(a.px[o + 1] - b.px[o + 1]);
        const db = Math.abs(a.px[o + 2] - b.px[o + 2]);
        sum += dr + dg + db;
        if (dr > noiseFloor || dg > noiseFloor || db > noiseFloor) changed++;
    }
    return { meanDelta: sum / (n * 3), changedPct: (changed / n) * 100 };
}

function main() {
    const args = parseArgs(process.argv);
    if (!args.candidate) {
        console.error("usage: node Tools/visual-regression.js --candidate <dir> [--update] [--tolerance N]");
        process.exit(2);
    }
    if (!fs.existsSync(args.candidate)) {
        console.error(`candidate directory does not exist: ${args.candidate}`);
        process.exit(2);
    }

    if (args.update) {
        // Create the directory explicitly. The capture tool does NOT create
        // missing directories and reports success anyway — an entire batch once
        // went nowhere because of it (recorded in prompts.md).
        fs.mkdirSync(args.golden, { recursive: true });
    }
    if (!fs.existsSync(args.golden) && !args.update) {
        console.error(`no golden set at ${args.golden}. Run once with --update to create it.`);
        process.exit(2);
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "visreg-"));
    const rows = [];
    let failed = false;

    for (const name of EXPECTED_FRAMES) {
        const candPath = path.join(args.candidate, `${name}.png`);
        const goldPath = path.join(args.golden, `${name}.png`);

        if (!fs.existsSync(candPath)) {
            rows.push({ name, status: "MISSING CAPTURE", detail: candPath });
            failed = true;
            continue;
        }
        if (args.update) {
            fs.copyFileSync(candPath, goldPath);
            rows.push({ name, status: "written", detail: "" });
            continue;
        }
        if (!fs.existsSync(goldPath)) {
            rows.push({ name, status: "NO GOLDEN", detail: "run with --update to accept" });
            failed = true;
            continue;
        }

        const cand = readPixels(candPath, tmpDir);
        const gold = readPixels(goldPath, tmpDir);
        const result = compare(gold, cand);
        if (!result) {
            rows.push({ name, status: "SIZE CHANGED", detail: `${gold.width}x${gold.height} -> ${cand.width}x${cand.height}` });
            failed = true;
            continue;
        }
        const over = result.changedPct > args.tolerance;
        if (over) failed = true;
        rows.push({
            name,
            status: over ? "CHANGED" : "ok",
            detail: `changed ${result.changedPct.toFixed(2)}%  meanDelta ${result.meanDelta.toFixed(2)}`,
        });
    }

    fs.rmSync(tmpDir, { recursive: true, force: true });

    const width = Math.max(...rows.map((r) => r.name.length));
    console.log("");
    console.log(args.update ? "Golden set updated:" : `Visual regression vs ${path.relative(REPO, args.golden)} (tolerance ${args.tolerance}% of pixels):`);
    console.log("");
    for (const r of rows) {
        console.log(`  ${r.name.padEnd(width)}  ${r.status.padEnd(15)} ${r.detail}`);
    }
    console.log("");
    if (args.update) { console.log("Review the diff before committing — --update accepts whatever was captured."); process.exit(0); }
    console.log(failed ? "FAIL — at least one frame changed or is missing." : "PASS — every frame within tolerance.");
    process.exit(failed ? 1 : 0);
}

main();
