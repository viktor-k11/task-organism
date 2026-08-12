/*
 * Thicken (and slightly shorten) the cat's tail.
 *
 * WHY THIS EXISTS, and why it is not a decimation setting:
 * the tail reads as a thin spike, but that is the SOURCE model's geometry, not
 * an artifact of simplifying it. Measured cross-sections by height band, source
 * (19846 verts) vs decimated (3814):
 *
 *     y band        source x-span / z-span     decimated x-span / z-span
 *     0.444-0.456   0.020 / 0.037              0.019 / 0.037
 *     0.456-0.468   0.018 / 0.015              0.018 / 0.012
 *
 * i.e. identical. Decimation also kept a HIGHER share of the tail than of the
 * model overall (71 of 138 tail verts, 51%, against 19% mesh-wide). Above
 * y = 0.384 the only geometry present is the tail: a column roughly
 * 0.021 x 0.025 units across, which at this project's display scale
 * (~73 cm per unit for a 34 cm cat) is about 1.5 x 1.8 cm thick and stands
 * ~6 cm above the head. Re-running the decimation at any ratio cannot fix a
 * shape the input already has, so the geometry itself is edited here.
 *
 * Usage: node reshape-cat-tail.js <in.glb> <out.glb>
 * Run BEFORE bake-vertex-shading.js — the bake reads positions and normals.
 */
const fs = require("fs");

/** Above this height the mesh is tail only (measured; head tops out here). */
const HEAD_TOP_Y = 0.384;
/** Tail sits at the rear. Full effect below this z, easing off toward Z_SOFT. */
const Z_TAIL = -0.24;
const Z_SOFT = -0.18;
/** Vertical ease-in, kept low and long so the tail base blends into the rump
 *  instead of stepping where the thickening starts. */
const Y_BLEND_START = 0.32;
const Y_FULL = 0.40;
/** Radial expansion about the tail's own per-slice axis. 2.4 takes the tail
 *  from ~1.5cm to ~3.6cm thick — reads as a limb, still slimmer than a leg. */
const THICKEN = 2.4;
/** Compress only the part standing above the head, so the raised-tail
 *  silhouette survives without towering. Overall mesh height drops ~3%. */
const HEIGHT_SCALE = 0.82;
const SLICE = 0.01;

function readGlb(path) {
    const buf = fs.readFileSync(path);
    if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error("not a glb: " + path);
    const total = buf.readUInt32LE(8);
    let off = 12;
    let json = null;
    let bin = null;
    while (off + 8 <= total) {
        const len = buf.readUInt32LE(off);
        const type = buf.readUInt32LE(off + 4);
        const data = buf.slice(off + 8, off + 8 + len);
        if (type === 0x4e4f534a) json = JSON.parse(data.toString("utf8"));
        else if (type === 0x004e4942) bin = Buffer.from(data);
        off += 8 + len;
    }
    return { json, bin };
}

function smoothstep(edge0, edge1, x) {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
}

function reshape(inPath, outPath) {
    const { json, bin } = readGlb(inPath);
    const prim = json.meshes[0].primitives[0];
    const acc = json.accessors[prim.attributes.POSITION];
    const view = json.bufferViews[acc.bufferView];
    const base = (view.byteOffset || 0) + (acc.byteOffset || 0);
    const stride = view.byteStride || 12;

    const read = (i) => [
        bin.readFloatLE(base + i * stride),
        bin.readFloatLE(base + i * stride + 4),
        bin.readFloatLE(base + i * stride + 8),
    ];

    // Weight per vertex: how much of the tail treatment it receives.
    const weights = new Float32Array(acc.count);
    for (let i = 0; i < acc.count; i++) {
        const [, y, z] = read(i);
        weights[i] = smoothstep(Y_BLEND_START, Y_FULL, y) * (1 - smoothstep(Z_TAIL, Z_SOFT, z));
    }

    // Per-height-slice tail axis, from core tail vertices only, so the
    // expansion is about the tail's centreline rather than the model origin.
    const axis = new Map();
    for (let i = 0; i < acc.count; i++) {
        if (weights[i] < 0.5) continue;
        const [x, y, z] = read(i);
        const key = Math.floor(y / SLICE);
        const a = axis.get(key) || { x: 0, z: 0, n: 0 };
        a.x += x; a.z += z; a.n++;
        axis.set(key, a);
    }
    for (const a of axis.values()) { a.x /= a.n; a.z /= a.n; }

    function axisAt(y) {
        const key = Math.floor(y / SLICE);
        for (let d = 0; d < 12; d++) {
            const hit = axis.get(key - d) || axis.get(key + d);
            if (hit) return hit;
        }
        return null;
    }

    let touched = 0;
    let maxYBefore = -Infinity;
    let maxYAfter = -Infinity;
    for (let i = 0; i < acc.count; i++) {
        let [x, y, z] = read(i);
        maxYBefore = Math.max(maxYBefore, y);
        const w = weights[i];
        if (w > 0.001) {
            const a = axisAt(y);
            if (a) {
                const scale = 1 + (THICKEN - 1) * w;
                x = a.x + (x - a.x) * scale;
                z = a.z + (z - a.z) * scale;
            }
            if (y > HEAD_TOP_Y) {
                const compressed = HEAD_TOP_Y + (y - HEAD_TOP_Y) * HEIGHT_SCALE;
                y = y + (compressed - y) * w;
            }
            touched++;
            bin.writeFloatLE(x, base + i * stride);
            bin.writeFloatLE(y, base + i * stride + 4);
            bin.writeFloatLE(z, base + i * stride + 8);
        }
        maxYAfter = Math.max(maxYAfter, y);
    }

    // POSITION min/max are normative in glTF — importers use them for bounds.
    let mn = [Infinity, Infinity, Infinity];
    let mx = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < acc.count; i++) {
        const p = read(i);
        for (let c = 0; c < 3; c++) { mn[c] = Math.min(mn[c], p[c]); mx[c] = Math.max(mx[c], p[c]); }
    }
    acc.min = mn;
    acc.max = mx;

    let jsonText = JSON.stringify(json);
    while (jsonText.length % 4 !== 0) jsonText += " ";
    const jsonBuf = Buffer.from(jsonText, "utf8");
    const total = 12 + 8 + jsonBuf.length + 8 + bin.length;
    const out = Buffer.alloc(total);
    out.writeUInt32LE(0x46546c67, 0);
    out.writeUInt32LE(2, 4);
    out.writeUInt32LE(total, 8);
    out.writeUInt32LE(jsonBuf.length, 12);
    out.writeUInt32LE(0x4e4f534a, 16);
    jsonBuf.copy(out, 20);
    const bh = 20 + jsonBuf.length;
    out.writeUInt32LE(bin.length, bh);
    out.writeUInt32LE(0x004e4942, bh + 4);
    bin.copy(out, bh + 8);
    fs.writeFileSync(outPath, out);

    console.log(`  reshaped ${touched}/${acc.count} verts`);
    console.log(`  height ${maxYBefore.toFixed(4)} -> ${maxYAfter.toFixed(4)}`);
    console.log(`  wrote ${outPath}`);
}

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) { console.error("usage: node reshape-cat-tail.js <in.glb> <out.glb>"); process.exit(1); }
console.log("reshaping", inPath);
reshape(inPath, outPath);
