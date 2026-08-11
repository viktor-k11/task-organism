import { buildLathe } from "../Creature/LatheGeometry";
import {
    HABITAT_HOME_DEPTH_CM,
    HABITAT_HOME_FLOOR_Y_CM,
    READYMADE_PET_HALF_HEIGHT_CM,
    CHASE_DISTANCE_MIN_CM,
} from "../Config/CreatureConfig";

const FLOOR_RADIUS_CM = 200;
/** Soft, translucent dark disc, unlit — reads as a ground shadow/vignette
 *  rather than an opaque UI plane sitting over the AR passthrough video. */
const FLOOR_COLOR: [number, number, number, number] = [0.05, 0.04, 0.04, 0.4];

const baseMaterialAsset = requireAsset("../../Materials/BlobBody.mat") as Material;

/**
 * HabitatFloor — a single large, soft, translucent ground disc spanning
 * both the habitat and chase zones, giving Preview a visible floor plane so
 * creatures read as grounded (their own per-creature ContactShadow reads
 * clearly against it) rather than floating over the passthrough video.
 * World-anchored once at setup, matching the rest of the scene's "anchor
 * once at spawn, don't continuously recenter on the camera" convention
 * (see CreatureBehavior.recomputeHabitatOrigin).
 */
export function buildHabitatFloor(cameraObject: SceneObject): SceneObject {
    const camTransform = cameraObject.getTransform();
    const camPos = camTransform.getWorldPosition();
    // Same inversion CreatureBehavior applies for this project's Camera Object
    // (Transform.forward reports the opposite of the camera's actual view direction).
    const camFwd = camTransform.forward.uniformScale(-1);
    const centerDepthCm = (CHASE_DISTANCE_MIN_CM + HABITAT_HOME_DEPTH_CM) / 2;
    const center = camPos.add(camFwd.uniformScale(centerDepthCm));
    const floorY = camPos.y + HABITAT_HOME_FLOOR_Y_CM - READYMADE_PET_HALF_HEIGHT_CM;

    const floor = global.scene.createSceneObject("HabitatFloor");
    floor.getTransform().setWorldPosition(new vec3(center.x, floorY, center.z));

    const rmv = floor.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    const builder = new MeshBuilder([
        { name: "position", components: 3 },
        { name: "normal", components: 3, normalized: true },
        { name: "color", components: 4 },
    ]);
    builder.topology = MeshTopology.Triangles;
    builder.indexType = MeshIndexType.UInt16;
    buildLathe(builder, [[0, -0.2], [FLOOR_RADIUS_CM, 0], [0, 0.2]], 64, FLOOR_COLOR);
    rmv.mesh = builder.getMesh();

    const mat = baseMaterialAsset.clone();
    mat.mainPass.baseColor = new vec4(FLOOR_COLOR[0], FLOOR_COLOR[1], FLOOR_COLOR[2], FLOOR_COLOR[3]);
    mat.mainPass.blendMode = BlendMode.Normal;
    mat.mainPass.twoSided = true;
    rmv.mainMaterial = mat;
    builder.updateMesh();

    return floor;
}
