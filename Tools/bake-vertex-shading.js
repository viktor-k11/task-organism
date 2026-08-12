/*
 * Bake a vertical gradient + normal-based volume term into a .glb as COLOR_0
 * vertex colors, so an unlit material can multiply it in for free at runtime.
 *
 * Shading model (all per-vertex, no lighting at runtime):
 *   height  = normalize(y) over the mesh's own bbox -> darker at the feet,
 *             lighter toward the back/head. Gamma'd so the darkening is
 *             concentrated low on the body instead of spread evenly.
 *   dome    = normal.y remapped 0..1 -> up-facing surfaces read lighter,
 *             down-facing (belly, under the jaw, undersides of legs) darker.
 *             This is what actually makes it read as a volume rather than a
 *             vertical ramp painted on a cutout.
 *
 * Output is a grayscale multiplier in RGB (A = 1), so it composes with the
 * per-creature identity tint the material already applies via baseColor.
 *
 * Usage: node bake_vertex_shading.js <in.glb> <out.glb>
 */
const fs = require("fs");

const HEIGHT_WEIGHT = 0.62;   // how much of the shading comes from height
const DOME_WEIGHT = 0.38;     // ...and how much from surface orientation
const HEIGHT_GAMMA = 0.75;    // <1 lifts mid heights, keeping only the lowest parts dark
const MIN_SHADE = 0.34;       // darkest multiplier (feet/underside)
const MAX_SHADE = 1.0;        // brightest multiplier (back/head)

function readGlb(path) {
    const buf = fs.readFileSync(path);
    if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error("not a glb: " + path);
    const total = buf.readUInt32LE(8);
    let off = 12;
    let json = null;
    let bin = null;
    let binPadded = 0;
    while (off + 8 <= total) {
        const len = buf.readUInt32LE(off);
        const type = buf.readUInt32LE(off + 4);
        const data = buf.slice(off + 8, off + 8 + len);
        if (type === 0x4e4f534a) json = JSON.parse(data.toString("utf8"));
        else if (type === 0x004e4942) { bin = data; binPadded = len; }
        off += 8 + len;
    }
    if (!json || !bin) throw new Error("missing chunk in " + path);
    return { json, bin, binPadded };
}

const COMPONENT_BYTES = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const TYPE_COUNT = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

function readAccessorVec(json, bin, index) {
    const acc = json.accessors[index];
    if (acc.componentType !== 5126) throw new Error("expected float accessor, got " + acc.componentType);
    const n = TYPE_COUNT[acc.type];
    const view = json.bufferViews[acc.bufferView];
    const base = (view.byteOffset || 0) + (acc.byteOffset || 0);
    const stride = view.byteStride || n * 4;
    const out = new Float32Array(acc.count * n);
    for (let i = 0; i < acc.count; i++) {
        for (let c = 0; c < n; c++) out[i * n + c] = bin.readFloatLE(base + i * stride + c * 4);
    }
    return { data: out, count: acc.count, n };
}

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

function bake(inPath, outPath) {
    const { json, bin } = readGlb(inPath);
    const chunks = [bin];
    let binLength = bin.length;

    for (const mesh of json.meshes) {
        for (const prim of mesh.primitives) {
            if (prim.attributes.COLOR_0 !== undefined) {
                console.log("  skip: primitive already has COLOR_0");
                continue;
            }
            const pos = readAccessorVec(json, bin, prim.attributes.POSITION);
            const nrm = prim.attributes.NORMAL !== undefined
                ? readAccessorVec(json, bin, prim.attributes.NORMAL)
                : null;

            let minY = Infinity;
            let maxY = -Infinity;
            for (let i = 0; i < pos.count; i++) {
                const y = pos.data[i * pos.n + 1];
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
            const span = maxY - minY || 1;

            // Unsigned-byte normalized COLOR_0 keeps the file small and is
            // universally supported; 8 bits is plenty for a smooth ramp.
            const colors = Buffer.alloc(pos.count * 4);
            for (let i = 0; i < pos.count; i++) {
                const y = pos.data[i * pos.n + 1];
                const height = Math.pow(clamp01((y - minY) / span), HEIGHT_GAMMA);
                const ny = nrm ? nrm.data[i * nrm.n + 1] : 0;
                const dome = clamp01(ny * 0.5 + 0.5);
                const shade = MIN_SHADE + (MAX_SHADE - MIN_SHADE)
                    * clamp01(HEIGHT_WEIGHT * height + DOME_WEIGHT * dome);
                const b = Math.round(clamp01(shade) * 255);
                colors[i * 4 + 0] = b;
                colors[i * 4 + 1] = b;
                colors[i * 4 + 2] = b;
                colors[i * 4 + 3] = 255;
            }

            const byteOffset = binLength;
            chunks.push(colors);
            binLength += colors.length;
            const pad = (4 - (binLength % 4)) % 4;
            if (pad) { chunks.push(Buffer.alloc(pad)); binLength += pad; }

            json.bufferViews.push({ buffer: 0, byteOffset, byteLength: colors.length, target: 34962 });
            json.accessors.push({
                bufferView: json.bufferViews.length - 1,
                componentType: 5121, // UNSIGNED_BYTE
                normalized: true,
                count: pos.count,
                type: "VEC4",
            });
            prim.attributes.COLOR_0 = json.accessors.length - 1;
            console.log(`  baked COLOR_0 for ${pos.count} verts (y ${minY.toFixed(3)}..${maxY.toFixed(3)})`);
        }
    }

    json.buffers[0].byteLength = binLength;
    const newBin = Buffer.concat(chunks, binLength);
    let jsonText = JSON.stringify(json);
    while (jsonText.length % 4 !== 0) jsonText += " ";
    const jsonBuf = Buffer.from(jsonText, "utf8");

    const total = 12 + 8 + jsonBuf.length + 8 + newBin.length;
    const out = Buffer.alloc(total);
    out.writeUInt32LE(0x46546c67, 0);
    out.writeUInt32LE(2, 4);
    out.writeUInt32LE(total, 8);
    out.writeUInt32LE(jsonBuf.length, 12);
    out.writeUInt32LE(0x4e4f534a, 16);
    jsonBuf.copy(out, 20);
    const binHeader = 20 + jsonBuf.length;
    out.writeUInt32LE(newBin.length, binHeader);
    out.writeUInt32LE(0x004e4942, binHeader + 4);
    newBin.copy(out, binHeader + 8);
    fs.writeFileSync(outPath, out);
    console.log(`  wrote ${outPath} (${out.length} bytes)`);
}

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) { console.error("usage: node bake_vertex_shading.js <in.glb> <out.glb>"); process.exit(1); }
console.log("baking", inPath);
bake(inPath, outPath);
