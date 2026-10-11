import { IDLE, type Gaze } from "@/features/mascot/domain/eye-tracking";
import type { FaceState } from "@/features/mascot/domain/face";
import { BLINK_MS, blinkLid, GAZE_RESPONSE } from "@/features/mascot/domain/rules";
import { springStep } from "@/features/mascot/domain/spring";
import type { FaceRenderer } from "./face-renderer";

const ZERO_FACE: FaceState = { tilt: 0, pupil: 0, lid0: 0, lid1: 0, rest: 0 };

interface FrameHooks {
  /** Can it animate now (mounted, tab visible, mascot on screen)? */
  canRun: () => boolean;
  /** Per-frame adjustments ("waiting" gaze, "listening" voice); `keepAlive` keeps the loop going. */
  beforeFrame: (time: number) => { gaze?: Gaze; face?: FaceState; keepAlive: boolean };
  /** Spring response for each facial feature (slower while sleeping). */
  responseFor: (key: keyof FaceState) => number;
}

/**
 * Gaze and face animated by springs towards their targets, written straight to the DOM every
 * frame (no React render). The loop only runs while something has not settled.
 */
export function createFaceAnimator(renderer: FaceRenderer, initial: FaceState, hooks: FrameHooks) {
  let gazeTarget: Gaze = IDLE;
  let faceTarget: FaceState = { ...initial };
  const gaze: Gaze = { ...IDLE };
  const gazeVelocity: Gaze = { ...IDLE };
  const face: FaceState = { ...initial };
  const faceVelocity: FaceState = { ...ZERO_FACE };
  let frame = 0;
  let lastTime = 0;
  let blinkStarted = 0;

  function step(time: number) {
    if (!hooks.canRun()) {
      frame = 0;
      return;
    }
    // The rAF time is the frame start and may come before lastTime: never negative.
    const elapsedSeconds = Math.min(Math.max(0, (time - lastTime) / 1000), 1 / 30);
    lastTime = time;
    const extra = hooks.beforeFrame(time);
    if (extra.gaze) gazeTarget = extra.gaze;
    if (extra.face) faceTarget = extra.face;
    const gazeSettled = springStep(gaze, gazeVelocity, gazeTarget, GAZE_RESPONSE, elapsedSeconds);
    const faceSettled = springStep(
      face,
      faceVelocity,
      faceTarget,
      hooks.responseFor,
      elapsedSeconds,
    );
    // The rAF time may come before blinkStarted: count it as the start, without dropping the blink.
    const progress = blinkStarted ? Math.max(0, (time - blinkStarted) / BLINK_MS) : 1;
    const blinking = progress < 1;
    if (!blinking) blinkStarted = 0;
    const lid = blinkLid(progress);
    renderer.render(
      gaze,
      {
        ...face,
        lid0: Math.max(lid, face.lid0),
        lid1: Math.max(lid, face.lid1),
      },
      face,
    );
    frame =
      gazeSettled && faceSettled && !blinking && !extra.keepAlive ? 0 : requestAnimationFrame(step);
  }

  return {
    setTargets(nextGaze: Gaze, nextFace: FaceState) {
      gazeTarget = nextGaze;
      faceTarget = nextFace;
    },
    /** Starts a blink (shows up on the next frame). */
    blink() {
      blinkStarted = performance.now();
    },
    cancelBlink() {
      blinkStarted = 0;
    },
    /** Ensures the loop is running (does not duplicate it if already running). */
    start() {
      if (frame) return;
      lastTime = performance.now();
      frame = requestAnimationFrame(step);
    },
    /** Stops the loop and forgets the blink (hidden tab, off screen). */
    pause() {
      cancelAnimationFrame(frame);
      frame = 0;
      blinkStarted = 0;
    },
    /** Reduced motion: jumps straight to the targets, no springs. */
    snap() {
      cancelAnimationFrame(frame);
      frame = 0;
      Object.assign(gaze, gazeTarget);
      Object.assign(face, faceTarget);
      Object.assign(gazeVelocity, IDLE);
      Object.assign(faceVelocity, ZERO_FACE);
      renderer.render(gaze, face);
    },
    dispose() {
      cancelAnimationFrame(frame);
      frame = 0;
    },
  };
}
