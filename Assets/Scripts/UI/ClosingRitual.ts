import { RITUAL } from "./UiCopy";
import { buildBackdrop, ICON_HOURGLASS, RetroDialog } from "./RetroUi";
import { resolveAnchor, UI_ANCHORS } from "./UiLayout";

const ritualTrack = requireAsset("../../GeneratedSFX/ClosingRitual.wav") as AudioTrackAsset;
/** Wide rolling hills to rest the eyes on for the minute. */
const ritualSky = requireAsset("../../Generated Textures/RitualHillsWide.png") as Texture;

/** The always-on twinkle layer: pixel motes filling the room, gently pulsing.
 *  Two shapes — mostly round dots, with four-point stars in between. */
let sparkleTexture: Texture | null = null;
let sparkleDotTexture: Texture | null = null;
try {
    sparkleTexture = requireAsset("../../Design assets/IconSparkle_64x64.png") as Texture;
    sparkleDotTexture = requireAsset("../../Design assets/IconSparkleDot_64x64.png") as Texture;
} catch (error) {
    print("[ClosingRitual] sparkle textures missing — ritual runs without stars");
}
const sparkleMaterial = requireAsset("../../Materials/UiArtwork.mat") as Material;

const STAR_COUNT = 44;
/** Fraction of the field that is round dots rather than four-point stars. */
const STAR_ROUND_FRACTION = 0.65;
/**
 * The field SURROUNDS the user — anchored at the head's position at ritual
 * start and spread through the whole room, so looking around during the
 * minute finds sparkles everywhere (the same "big in the room" treatment
 * as the landscape backdrop). Radii in cm.
 */
const STAR_RADIUS_MIN = 70, STAR_RADIUS_MAX = 240;
const STAR_Y_MIN = -70, STAR_Y_MAX = 130;
const STAR_SIZE_MIN = 2.4, STAR_SIZE_MAX = 5.2;
/** Slow upward float, wrapped so the field never empties. */
const STAR_RISE_CM_PER_S_MIN = 1.5, STAR_RISE_CM_PER_S_MAX = 4.5;
const STAR_RISE_WRAP_CM = 60;

interface TwinkleStar {
    transform: Transform;
    baseSize: number;
    phase: number;
    speed: number;
    riseSpeed: number;
    /** Local Y the drift started from, for the wrap. */
    homeY: number;
}

const TOTAL_SECONDS = 60;

/**
 * The optional 1-minute closing ritual, offered after TODAY.TXT.
 *
 * Three 20-second stages of breathing copy with a countdown, over a slow
 * meditative bed. Entirely opt-in and interruptible: the button that opens it
 * is offered, never forced, and closing the card stops the audio.
 *
 * The countdown runs on the frame clock rather than DelayedCallbackEvents so
 * a stage change and the visible timer can never drift apart.
 */
export class ClosingRitual {
    private dialog: RetroDialog | null = null;
    private backdrop: SceneObject | null = null;
    private audio: AudioComponent | null = null;
    /** The twinkle layer, rebuilt each ritual and destroyed with it. */
    private starsRoot: SceneObject | null = null;
    private stars: TwinkleStar[] = [];
    private twinkleT = 0;
    private remainingS = -1;
    private stageIndex = -1;

    constructor(private camera: SceneObject | null) {}

    get isRunning(): boolean {
        return this.remainingS >= 0;
    }

    start(): void {
        this.stop();
        this.remainingS = TOTAL_SECONDS;
        this.stageIndex = -1;
        // Something restful to look at for the whole minute, the same full
        // wallpaper treatment the welcome screen uses.
        this.backdrop = buildBackdrop(this.camera, ritualSky);
        // (A Sketchfab-era "Sparkles Post Effect" package was tried here and
        // removed: it keys on bright camera-feed spots and painted glare
        // streaks across lit scenes. The twinkle motes below are the
        // ritual's animation.)
        this.buildStars();
        this.playBed();
        this.showStage(0);
    }

    stop(): void {
        this.remainingS = -1;
        this.stageIndex = -1;
        if (this.audio) {
            this.audio.stop(true);
            this.audio = null;
        }
        if (this.dialog) {
            this.dialog.destroy();
            this.dialog = null;
        }
        if (this.backdrop) {
            this.backdrop.destroy();
            this.backdrop = null;
        }
        if (this.starsRoot) {
            this.starsRoot.destroy();
            this.starsRoot = null;
        }
        this.stars = [];
    }


    /**
     * The twinkle layer: pixel motes filling the room around the user —
     * WORLD-anchored at the head's position at ritual start (like the
     * landscape backdrop), spread through a full 360°, so the minute has
     * sparkles wherever the eyes wander. Every mote billboards to the
     * camera each frame, twinkles on its own phase, and floats slowly
     * upward with a wrap so the field never empties.
     */
    private buildStars(): void {
        if (!sparkleTexture || !sparkleDotTexture) return;
        this.twinkleT = 0;
        this.stars = [];
        this.starsRoot = global.scene.createSceneObject("RitualStars");
        if (this.camera) {
            this.starsRoot.getTransform().setWorldPosition(this.camera.getTransform().getWorldPosition());
        }
        // Two shared materials — one per shape — never one per mote.
        const starMaterial = sparkleMaterial.clone();
        starMaterial.mainPass.baseTex = sparkleTexture;
        const dotMaterial = sparkleMaterial.clone();
        dotMaterial.mainPass.baseTex = sparkleDotTexture;
        for (let i = 0; i < STAR_COUNT; i++) {
            const object = global.scene.createSceneObject(`RitualStar${i}`);
            object.setParent(this.starsRoot);
            const angle = Math.random() * Math.PI * 2;
            const radius = STAR_RADIUS_MIN + Math.random() * (STAR_RADIUS_MAX - STAR_RADIUS_MIN);
            const y = STAR_Y_MIN + Math.random() * (STAR_Y_MAX - STAR_Y_MIN);
            object.getTransform().setLocalPosition(new vec3(Math.sin(angle) * radius, y, Math.cos(angle) * radius));
            const image = object.createComponent("Component.Image") as Image;
            image.mainMaterial = Math.random() < STAR_ROUND_FRACTION ? dotMaterial : starMaterial;
            this.stars.push({
                transform: object.getTransform(),
                baseSize: STAR_SIZE_MIN + Math.random() * (STAR_SIZE_MAX - STAR_SIZE_MIN),
                phase: Math.random() * Math.PI * 2,
                speed: 0.7 + Math.random() * 1.1,
                riseSpeed: STAR_RISE_CM_PER_S_MIN + Math.random() * (STAR_RISE_CM_PER_S_MAX - STAR_RISE_CM_PER_S_MIN),
                homeY: y,
            });
        }
    }

    /** Twinkle + float + billboard, all cheap per-frame transform writes. */
    private updateStars(dt: number): void {
        if (!this.stars.length) return;
        this.twinkleT += dt;
        // Billboard by copying the camera's orientation — quads parallel to
        // the view plane face the user without any per-star look-at math.
        const camRotation = this.camera ? this.camera.getTransform().getWorldRotation() : null;
        for (const star of this.stars) {
            const wave = 0.5 + 0.5 * Math.sin(this.twinkleT * star.speed + star.phase);
            const size = star.baseSize * (0.15 + 0.85 * wave * wave);
            star.transform.setLocalScale(new vec3(size, size, 1));
            const position = star.transform.getLocalPosition();
            position.y += star.riseSpeed * dt;
            if (position.y > star.homeY + STAR_RISE_WRAP_CM) position.y = star.homeY;
            star.transform.setLocalPosition(position);
            if (camRotation) star.transform.setWorldRotation(camRotation);
        }
    }

    update(dt: number): void {
        // Stars keep breathing on the closing card too (timer already done).
        this.updateStars(dt);
        if (this.remainingS < 0) return;
        this.remainingS -= dt;

        if (this.remainingS <= 0) {
            this.showEnd();
            return;
        }
        // Stage 0 from 60s, stage 1 from 40s, stage 2 from 20s.
        const wanted = this.remainingS > 40 ? 0 : this.remainingS > 20 ? 1 : 2;
        if (wanted !== this.stageIndex) {
            this.showStage(wanted);
        } else if (this.dialog) {
            this.dialog.setEmphasis(this.timerText());
        }
    }

    private showStage(index: number): void {
        this.stageIndex = index;
        const stage = RITUAL.stages[index];
        if (this.dialog) this.dialog.destroy();
        this.dialog = new RetroDialog(resolveAnchor(this.camera, UI_ANCHORS.dialog), {
            name: "Ritual",
            title: RITUAL.title,
            headline: stage.headline,
            body: RITUAL.stages[index].body,
            bodyHeightCm: 9,
            // The countdown is the largest thing on the screen — it is what
            // the minute is actually about.
            emphasis: this.timerText(),
            widthCm: 52,
            buttonWidthCm: 22,
            buttons: [{ label: RITUAL.endButton, action: () => this.stop() }],
            onClose: () => this.stop(),
            icon: ICON_HOURGLASS,
        });
    }

    /** The live countdown, rendered as the dialog's one big line. */
    private timerText(): string {
        return `${Math.max(0, Math.ceil(this.remainingS))} sec`;
    }

    private showEnd(): void {
        this.remainingS = -1;
        this.stageIndex = -1;
        if (this.dialog) this.dialog.destroy();
        this.dialog = new RetroDialog(resolveAnchor(this.camera, UI_ANCHORS.dialog), {
            name: "RitualEnd",
            title: RITUAL.title,
            headline: RITUAL.endHeadline,
            body: RITUAL.endBody,
            bodyHeightCm: 5,
            widthCm: 52,
            buttonWidthCm: 22,
            buttons: [{ label: RITUAL.endButton, action: () => this.stop() }],
            onClose: () => this.stop(),
            icon: ICON_HOURGLASS,
        });
        // The bed keeps playing under the closing card until it is dismissed —
        // cutting the music the instant the timer hits zero felt abrupt.
    }

    private playBed(): void {
        const host = this.camera ?? global.scene.createSceneObject("RitualAudio");
        this.audio = host.createComponent("Component.AudioComponent") as AudioComponent;
        this.audio.audioTrack = ritualTrack;
        this.audio.volume = 0.6;
        this.audio.play(1);
    }
}
