import { buildLathe } from "../Creature/LatheGeometry";
import {
    HABITAT_HOME_DEPTH_CM,
    HABITAT_HOME_GROUP_LATERAL_CM,
    GROUND_Y_OFFSET_CM,
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
/**
 * Re-anchors the disc to the camera's CURRENT pose and the given habitat
 * depth/lateral. Split out of buildHabitatFloor so the staging controls can
 * move the floor and the creatures together — if only one of them moved, the
 * disc and the creatures' foot line would drift apart, which is exactly the
 * class of bug GROUND_Y_OFFSET_CM was introduced to prevent.
 */
export function positionHabitatFloor(
    floor: SceneObject,
    cameraObject: SceneObject,
    habitatDepthCm: number,
    habitatLateralCm: number,
): void {
    const camTransform = cameraObject.getTransform();
    const camPos = camTransform.getWorldPosition();
    // Same inversion CreatureBehavior applies for this project's Camera Object
    // (Transform.forward reports the opposite of the camera's actual view direction).
    const camFwd = camTransform.forward.uniformScale(-1);
    // Flattened to the horizontal plane for the same reason as
    // CreatureBehavior.recomputeHabitatOrigin: head pitch at anchor time must
    // not pull the habitat closer. Both must use the SAME projection or the
    // disc and the creatures land at different depths.
    const camYaw = Math.atan2(camFwd.x, -camFwd.z);
    const flatFwd = new vec3(Math.sin(camYaw), 0, -Math.cos(camYaw));
    const right = new vec3(Math.cos(camYaw), 0, Math.sin(camYaw));
    // Disc spans from the chase ring out to the habitat, so its centre sits
    // midway between them and follows the habitat when that is moved.
    const centerDepthCm = (CHASE_DISTANCE_MIN_CM + habitatDepthCm) / 2;
    const center = camPos
        .add(flatFwd.uniformScale(centerDepthCm))
        .add(right.uniformScale(habitatLateralCm));
    // Same GROUND_Y_OFFSET_CM constant CreatureBehavior uses for MovementRoot's
    // world Y (see recomputeHabitatOrigin) — no separate correction term, so
    // this disc and every creature's rendered foot line can never drift apart
    // (see GROUND_Y_OFFSET_CM's doc comment in CreatureConfig for why the old
    // formula, which re-derived its own offset here, was the actual bug).
    const floorY = camPos.y + GROUND_Y_OFFSET_CM;
    floor.getTransform().setWorldPosition(new vec3(center.x, floorY, center.z));
}

export function buildHabitatFloor(cameraObject: SceneObject): SceneObject {
    const floor = global.scene.createSceneObject("HabitatFloor");
    positionHabitatFloor(floor, cameraObject, HABITAT_HOME_DEPTH_CM, HABITAT_HOME_GROUP_LATERAL_CM);

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
