/*
 * Prepare a downloaded pet GLB for this project's creature pipeline.
 *
 * This is the "skin-strip" step, made explicit. It does three things, all of
 * which must happen BEFORE Tools/bake-vertex-shading.js:
 *
 *  1. STRIP THE RIG. Removes skins, animations and the JOINTS_0/WEIGHTS_0
 *     attributes. CLAUDE.md mandates direct transform control with no physics
 *     and no competing animation; a skinned, auto-animating mesh fights
 *     CreatureBehavior for control of the same transforms.
 *
 *  2. FLATTEN THE NODE TRANSFORM INTO THE VERTICES. Source packs are often
 *     authored Z-up and exported with a -90 deg X rotation on the mesh node
 *     (plus a unit scale) to present as Y-up. Our bake ramps over Y and reads
 *     normal.y, so running it against raw Z-up vertex data would paint the
 *     gradient along the animal's LENGTH instead of its height. Baking the
 *     node's world matrix into POSITION and NORMAL makes the file honestly
 *     Y-up and self-contained.
 *
 *  3. DROP ANY EXISTING COLOR_0. Quaternius meshes ship vertex colours for
 *     their own palette. We replace the material with the project's unlit
 *     PetBody material and tint per task, so those colours are unused — and
 *     bake-vertex-shading.js SKIPS any primitive that already has COLOR_0,
 *     so leaving them would silently produce an unshaded creature.
 *
 * Usage: node prepare-pet-glb.js <in.glb> <out.glb>
 * Then:  node bake-vertex-shading.js <out.glb> <final.glb>
 */
const fs = require("fs");

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

const TYPE_COUNT = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

/** Compose a node's local TRS into a 4x4 (column-major, glTF convention). */
function trs(node) {
    const t = node.translation || [0, 0, 0];
    const r = node.rotation || [0, 0, 0, 1];
    const s = node.scale || [1, 1, 1];
    const [x, y, z, w] = r;
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2;
    const yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;
    return [
        (1 - (yy + zz)) * s[0], (xy + wz) * s[0], (xz - wy) * s[0], 0,
        (xy - wz) * s[1], (1 - (xx + zz)) * s[1], (yz + wx) * s[1], 0,
        (xz + wy) * s[2], (yz - wx) * s[2], (1 - (xx + yy)) * s[2], 0,
        t[0], t[1], t[2], 1,
    ];
}

function mul(a, b) {
    const o = new Array(16).fill(0);
    for (let c = 0; c < 4; c++) {
        for (let r = 0; r < 4; r++) {
            let v = 0;
            for (let k = 0; k < 4; k++) v += a[k * 4 + r] * b[c * 4 + k];
            o[c * 4 + r] = v;
        }
    }
    return o;
}

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

/** World matrix of the first node that references `meshIndex`. */
function findMeshWorldMatrix(json, meshIndex) {
    let found = null;
    const walk = (nodeIndex, parent) => {
        const node = json.nodes[nodeIndex];
        const world = mul(parent, trs(node));
        if (node.mesh === meshIndex && !found) found = world;
        for (const child of node.children || []) walk(child, world);
    };
    const scene = json.scenes[json.scene || 0];
    for (const root of scene.nodes) walk(root, IDENTITY);
    return found || IDENTITY;
}

function transformPoint(m, p) {
    return [
        m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
        m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
        m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
    ];
}

/** Normals use the matrix without translation; uniform scale keeps this valid. */
function transformDir(m, v) {
    const o = [
        m[0] * v[0] + m[4] * v[1] + m[8] * v[2],
        m[1] * v[0] + m[5] * v[1] + m[9] * v[2],
        m[2] * v[0] + m[6] * v[1] + m[10] * v[2],
    ];
    const len = Math.hypot(o[0], o[1], o[2]) || 1;
    return [o[0] / len, o[1] / len, o[2] / len];
}

function prepare(inPath, outPath) {
    const { json, bin } = readGlb(inPath);
    const mesh = json.meshes[0];
    const world = findMeshWorldMatrix(json, 0);
    console.log("  node world matrix (col-major):", world.map((n) => +n.toFixed(4)).join(","));

    for (const prim of mesh.primitives) {
        // 1 + 3: drop rig attributes and any pre-existing vertex colours.
        for (const attr of ["JOINTS_0", "WEIGHTS_0", "COLOR_0"]) {
            if (prim.attributes[attr] !== undefined) {
                delete prim.attributes[attr];
                console.log(`  dropped attribute ${attr}`);
            }
        }

        // 2: bake the node transform into POSITION and NORMAL in place.
        for (const [name, fn] of [["POSITION", transformPoint], ["NORMAL", transformDir]]) {
            const idx = prim.attributes[name];
            if (idx === undefined) continue;
            const acc = json.accessors[idx];
            const view = json.bufferViews[acc.bufferView];
            const base = (view.byteOffset || 0) + (acc.byteOffset || 0);
            const stride = view.byteStride || TYPE_COUNT[acc.type] * 4;
            let mn = [Infinity, Infinity, Infinity];
            let mx = [-Infinity, -Infinity, -Infinity];
            for (let i = 0; i < acc.count; i++) {
                const at = base + i * stride;
                const v = fn(world, [
                    bin.readFloatLE(at),
                    bin.readFloatLE(at + 4),
                    bin.readFloatLE(at + 8),
                ]);
                bin.writeFloatLE(v[0], at);
                bin.writeFloatLE(v[1], at + 4);
                bin.writeFloatLE(v[2], at + 8);
                for (let c = 0; c < 3; c++) {
                    if (v[c] < mn[c]) mn[c] = v[c];
                    if (v[c] > mx[c]) mx[c] = v[c];
                }
            }
            if (name === "POSITION") {
                acc.min = mn;
                acc.max = mx;
                console.log(`  POSITION baked: min=[${mn.map((n) => +n.toFixed(4))}] max=[${mx.map((n) => +n.toFixed(4))}]`);
                console.log(`  height (Y) = ${(mx[1] - mn[1]).toFixed(4)}  length (Z) = ${(mx[2] - mn[2]).toFixed(4)}  width (X) = ${(mx[0] - mn[0]).toFixed(4)}`);
            }
        }
    }

    // 1 (cont.): remove the rig itself and flatten the scene to a single node,
    // so the importer cannot re-apply a transform we have already baked in.
    delete json.skins;
    delete json.animations;
    for (const node of json.nodes) delete node.skin;
    json.nodes = [{ name: "Pet", mesh: 0 }];
    json.scenes = [{ name: "Root Scene", nodes: [0] }];
    json.scene = 0;

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
    console.log(`  wrote ${outPath}`);
}

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) { console.error("usage: node prepare-pet-glb.js <in.glb> <out.glb>"); process.exit(1); }
console.log("preparing", inPath);
prepare(inPath, outPath);
