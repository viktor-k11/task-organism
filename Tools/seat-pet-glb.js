/**
 * seat-pet-glb.js — final placement step of the pet-asset pipeline.
 *
 * Runs after prepare-pet-glb.js (which bakes node transforms into the vertices)
 * and before bake-vertex-shading.js. Two jobs, both of which exist because a
 * generated mesh arrives in whatever pose the generator felt like using, while
 * CreaturePetVisual assumes ONE convention shared by every species:
 *
 *   1. FEET AT THE ORIGIN (min-Y = 0). CreaturePetVisual seats every prefab at
 *      localPosition.y = -READYMADE_PET_HALF_HEIGHT_CM, which only grounds the
 *      creature if the mesh's own origin sits at its feet. The reference dog
 *      GLB happens to satisfy this (min-Y 0.007); a center-origin mesh instead
 *      sinks half its height through the floor. Observed exactly that on the
 *      first SPECS cat, whose POSITION ran -0.5..+0.5.
 *
 *   2. FACING BAKED, NOT CORRECTED. Facing is a property of the asset, fixed
 *      once (the build-mesh contract says the same). Baking a 180-degree yaw
 *      here keeps READYMADE_PET_YAW_CORRECTION_DEG a single global constant
 *      instead of growing a per-species table that every future species would
 *      have to be hand-tuned into.
 *
 * Also reports BODY height (centreline dome top) alongside bbox height, because
 * display scale is derived from the body: scaling a sitting animal by its bbox
 * makes it read small, since upright ears eat height that the eye does not
 * count as part of the animal.
 *
 * Usage: node Tools/seat-pet-glb.js <in.glb> <out.glb> [--yaw180]
 */
const fs = require("fs");

const [, , inPath, outPath, ...flags] = process.argv;
if (!inPath || !outPath) {
    console.error("usage: node Tools/seat-pet-glb.js <in.glb> <out.glb> [--yaw180]");
    process.exit(1);
}
const yaw180 = flags.includes("--yaw180");

const buf = fs.readFileSync(inPath);
if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error("not a GLB");
const jsonLen = buf.readUInt32LE(12);
const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString("utf8"));
const binHeaderAt = 20 + jsonLen;
const binLen = buf.readUInt32LE(binHeaderAt);
const bin = Buffer.from(buf.slice(binHeaderAt + 8, binHeaderAt + 8 + binLen));

/** Every POSITION/NORMAL accessor reachable from a mesh primitive. */
function accessorsNamed(attr) {
    const out = new Set();
    for (const mesh of json.meshes || []) {
        for (const prim of mesh.primitives || []) {
            const idx = prim.attributes[attr];
            if (idx !== undefined) out.add(idx);
        }
    }
    return [...out];
}

function forEachVec3(accIdx, fn) {
    const acc = json.accessors[accIdx];
    const bv = json.bufferViews[acc.bufferView];
    const base = (bv.byteOffset || 0) + (acc.byteOffset || 0);
    const stride = bv.byteStride || 12;
    for (let i = 0; i < acc.count; i++) {
        const o = base + i * stride;
        const v = [bin.readFloatLE(o), bin.readFloatLE(o + 4), bin.readFloatLE(o + 8)];
        const r = fn(v);
        if (r) {
            bin.writeFloatLE(r[0], o);
            bin.writeFloatLE(r[1], o + 4);
            bin.writeFloatLE(r[2], o + 8);
        }
    }
}

const posAcc = accessorsNamed("POSITION");
const nrmAcc = accessorsNamed("NORMAL");

// --- pass 1: measure -------------------------------------------------------
let minY = Infinity, maxY = -Infinity, maxAbsX = 0;
const centreCandidates = [];
for (const a of posAcc) {
    forEachVec3(a, (v) => {
        if (v[1] < minY) minY = v[1];
        if (v[1] > maxY) maxY = v[1];
        if (Math.abs(v[0]) > maxAbsX) maxAbsX = Math.abs(v[0]);
    });
}
for (const a of posAcc) {
    forEachVec3(a, (v) => { if (Math.abs(v[0]) < maxAbsX * 0.06) centreCandidates.push(v[1]); });
}
const bboxH = maxY - minY;
// Ears/horns are off-centre in X, so the tallest point ON the centreline is the
// top of the head itself — the height the eye reads as "how big is this animal".
const domeTop = centreCandidates.length ? Math.max(...centreCandidates) : maxY;
const bodyH = domeTop - minY;

// --- pass 2: rewrite -------------------------------------------------------
for (const a of posAcc) {
    forEachVec3(a, (v) => {
        let [x, y, z] = v;
        if (yaw180) { x = -x; z = -z; }
        return [x, y - minY, z];
    });
}
if (yaw180) {
    for (const a of nrmAcc) forEachVec3(a, (v) => [-v[0], v[1], -v[2]]);
}

// Accessor min/max must match the rewritten data or the importer culls wrongly.
for (const a of posAcc) {
    const acc = json.accessors[a];
    let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    forEachVec3(a, (v) => {
        for (let k = 0; k < 3; k++) { if (v[k] < mn[k]) mn[k] = v[k]; if (v[k] > mx[k]) mx[k] = v[k]; }
    });
    acc.min = mn; acc.max = mx;
}

// --- write -----------------------------------------------------------------
const jsonOut = Buffer.from(JSON.stringify(json), "utf8");
const jsonPad = (4 - (jsonOut.length % 4)) % 4;
const binPad = (4 - (bin.length % 4)) % 4;
const jsonChunk = Buffer.concat([jsonOut, Buffer.alloc(jsonPad, 0x20)]);
const binChunk = Buffer.concat([bin, Buffer.alloc(binPad, 0)]);
const total = 12 + 8 + jsonChunk.length + 8 + binChunk.length;
const out = Buffer.alloc(total);
out.writeUInt32LE(0x46546c67, 0); out.writeUInt32LE(2, 4); out.writeUInt32LE(total, 8);
out.writeUInt32LE(jsonChunk.length, 12); out.writeUInt32LE(0x4e4f534a, 16);
jsonChunk.copy(out, 20);
out.writeUInt32LE(binChunk.length, 20 + jsonChunk.length);
out.writeUInt32LE(0x004e4942, 24 + jsonChunk.length);
binChunk.copy(out, 28 + jsonChunk.length);
fs.writeFileSync(outPath, out);

console.log(`  yaw180           ${yaw180}`);
console.log(`  re-seated        min-Y ${minY.toFixed(4)} -> 0`);
console.log(`  bbox height      ${bboxH.toFixed(4)} units`);
console.log(`  BODY height      ${bodyH.toFixed(4)} units  (${((bodyH / bboxH) * 100).toFixed(1)}% of bbox)`);
console.log(`  DISPLAY_SCALE for a 34cm body = ${(34 / bodyH).toFixed(3)}  -> bbox renders ${(34 * bboxH / bodyH).toFixed(1)}cm`);
console.log(`  wrote ${outPath}`);
