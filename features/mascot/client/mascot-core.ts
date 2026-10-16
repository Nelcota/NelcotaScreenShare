import { type Motion } from "@/features/mascot/domain/body-motions";
import { IDLE, type Gaze } from "@/features/mascot/domain/eye-tracking";
import { EXPRESSIONS, toFaceState, type Expression } from "@/features/mascot/domain/face";
import {
  createPersonality,
  voiceAmount,
  type MascotActivity,
  type MascotTemperament,
} from "@/features/mascot/domain/personality";
import { createReasons, type Reason } from "@/features/mascot/domain/reasons";
import {
  allowsPlay,
  blocksPlay,
  faceResponse,
  gazeFocus,
  isSleeping,
  listeningFace,
  temperamentFace,
  waitingGaze,
} from "@/features/mascot/domain/rules";
import { prefersReducedMotion } from "@/lib/animation/motion";
import { createFaceAnimator } from "./face-animator";
import type { FaceRenderer } from "./face-renderer";
import { focusTarget, gazeFor, passwordEyes } from "./gaze";
import { createHandMotions } from "./hand-motions";
import { createHostMotions } from "./host-motions";

/** What the component tells the controller (read on demand, without recreating anything). */
export interface MascotInputs {
  base: () => Expression;
  canSleep: () => boolean;
  activity: () => MascotActivity;
  /** Voice level (0–1) for "listening". */
  voice: () => number;
  temperament?: () => MascotTemperament;
}

/** What changes while the mascot lives; the controller and the core share this object. */
interface MascotState {
  pointer: { x: number; y: number } | null;
  current: Expression;
  /** After unmount, late updates (timers) do nothing. */
  disposed: boolean;
  onScreen: boolean;
}

interface GestureParts {
  hands: ReturnType<typeof createHandMotions>;
  personality: ReturnType<typeof createPersonality>;
  animator: ReturnType<typeof createFaceAnimator>;
  host: ReturnType<typeof createHostMotions>;
}

/** Face and gaze targets for the current expression. */
function createMascotLook(
  root: HTMLElement,
  face: HTMLElement,
  state: MascotState,
  attentionTarget: () => Element | undefined,
  inputs: MascotInputs,
) {
  const eyeOverride = () => passwordEyes(state.current);

  function faceTarget() {
    const pose = toFaceState(EXPRESSIONS[state.current], eyeOverride());
    return temperamentFace(pose, state.current, inputs.temperament?.() ?? "curious");
  }

  function gazeTarget() {
    const focus = gazeFocus(state.current);
    if (focus === "idle") return IDLE;
    const target = attentionTarget() ?? focusTarget(root, focus);
    return gazeFor(face, target, state.pointer);
  }

  /** Gaze that moves on its own every frame, without pointer or focus events. */
  function animatedGaze(time: number): Gaze | undefined {
    if (state.current === "waiting") return waitingGaze(time);
    if (gazeFocus(state.current) === "partner") return gazeTarget();
    return undefined;
  }

  return { eyeOverride, faceTarget, gazeTarget, animatedGaze };
}

function createMascotAnimator(
  root: HTMLElement,
  renderer: FaceRenderer,
  inputs: MascotInputs,
  state: MascotState,
  look: ReturnType<typeof createMascotLook>,
) {
  return createFaceAnimator(renderer, toFaceState(EXPRESSIONS[state.current]), {
    canRun: () => !state.disposed && !document.hidden && state.onScreen,
    beforeFrame(time) {
      const waiting = state.current === "waiting";
      const listening = state.current === "listening";
      const trackingPartner = gazeFocus(state.current) === "partner";
      const voice = listening ? voiceAmount(inputs.voice()) : 0;
      const nextFace = listening ? listeningFace(look.faceTarget(), voice) : undefined;
      root.style.setProperty("--voice", listening ? voice.toFixed(3) : "0");
      const gaze = look.animatedGaze(time);
      return {
        ...(gaze ? { gaze } : {}),
        ...(nextFace ? { face: nextFace } : {}),
        keepAlive: waiting || listening || trackingPartner,
      };
    },
    responseFor: (key) => faceResponse(state.current, key),
  });
}

/** Whole-body motion; turned off with reduced motion. */
function createBodyMotion(root: HTMLElement, state: MascotState) {
  let bodyAnimation: Animation | undefined;

  function stop() {
    bodyAnimation?.cancel();
    bodyAnimation = undefined;
  }

  function move({ keyframes, options }: Motion) {
    stop();
    if (prefersReducedMotion() || document.hidden || !state.onScreen) return undefined;
    bodyAnimation = root.animate(keyframes, options);
    return bodyAnimation;
  }

  return { move, stop, cancel: () => bodyAnimation?.cancel() };
}

/** Hands and gestures that the current expression does not allow stop here. */
function settleGestures(
  { hands, personality, animator, host }: GestureParts,
  current: Expression,
  eyes: readonly [number, number] | undefined,
) {
  // The closed pose takes priority over a wave started before the password got focus.
  if (eyes || isSleeping(current)) hands.cancel();
  if (personality.active && (eyes || blocksPlay(current))) personality.cancel();
  if (host.active && (personality.active || eyes || blocksPlay(current) || isSleeping(current))) {
    host.cancel();
  }
  if (eyes || current === "asleep" || prefersReducedMotion()) animator.cancelBlink();
}

/** Reduced motion: no springs or animations, straight to the final pose. */
function snapToTargets(root: HTMLElement, renderer: FaceRenderer, parts: GestureParts) {
  parts.host.cancel();
  root.getAnimations().forEach((animation) => animation.cancel());
  parts.hands.cancel();
  renderer.lids.forEach((lid) => lid.getAnimations().forEach((animation) => animation.cancel()));
  parts.animator.snap();
}

/**
 * Expression, gaze and face: reasons with deadline and priority become the current
 * expression (domain/reasons.ts), and the face animates towards it (client/face-animator.ts).
 */
export function createMascotCore(
  root: HTMLElement,
  face: HTMLElement,
  renderer: FaceRenderer,
  inputs: MascotInputs,
  attentionTarget: () => Element | undefined,
) {
  const hands = createHandMotions(root);
  const reasons = createReasons();
  const state: MascotState = {
    pointer: null,
    current: inputs.base(),
    disposed: false,
    onScreen: true,
  };
  let reasonTimer = 0;
  /** Update scheduled for the next frame (several events in the same frame become one). */
  let queuedUpdate = 0;
  const look = createMascotLook(root, face, state, attentionTarget, inputs);
  const animator = createMascotAnimator(root, renderer, inputs, state, look);
  const body = createBodyMotion(root, state);

  const personality = createPersonality({
    root,
    hands,
    react: (expression) => toggleReason("interaction", expression),
    move: body.move,
    stopMotion: body.stop,
    available: () =>
      !state.disposed &&
      state.onScreen &&
      !document.hidden &&
      !look.eyeOverride() &&
      allowsPlay(inputs.activity()) &&
      !blocksPlay(state.current),
  });
  const host = createHostMotions({
    root,
    hands,
    react: (expression) => toggleReason("host", expression),
    move: body.move,
    stopMotion: body.stop,
    presenting: () => inputs.activity() === "presenting",
    available: () =>
      !state.disposed &&
      state.onScreen &&
      !document.hidden &&
      !prefersReducedMotion() &&
      !look.eyeOverride() &&
      !blocksPlay(state.current) &&
      (inputs.activity() === "idle" || inputs.activity() === "presenting"),
  });
  const gestureParts: GestureParts = { hands, personality, animator, host };

  function setReason(reason: Reason, expression: Expression, durationMs?: number) {
    reasons.set(reason, expression, durationMs);
    update();
  }

  function clearReason(reason: Reason) {
    if (reasons.delete(reason)) update();
  }

  /** Sets the reason, or clears it when there is no expression. */
  function toggleReason(reason: Reason, expression: Expression | undefined) {
    if (!expression) {
      clearReason(reason);
      return;
    }
    setReason(reason, expression);
  }

  /** Schedules a re-evaluation for the next reason that will expire. */
  function scheduleReasonExpiry() {
    window.clearTimeout(reasonTimer);
    const next = reasons.nextExpiry();
    if (Number.isFinite(next)) {
      reasonTimer = window.setTimeout(update, Math.max(0, next - performance.now()) + 16);
    }
  }

  /** Recomputes expression and gaze and animates towards them (or jumps straight there, with reduced motion). */
  function update() {
    if (state.disposed) return;
    state.current = reasons.current(inputs.base());
    root.dataset.expression = state.current;
    root.dataset.motion = document.hidden || !state.onScreen ? "paused" : "active";
    scheduleReasonExpiry();
    animator.setTargets(look.gazeTarget(), look.faceTarget());
    settleGestures(gestureParts, state.current, look.eyeOverride());
    if (prefersReducedMotion()) {
      snapToTargets(root, renderer, gestureParts);
      return;
    }
    if (!document.hidden && state.onScreen) animator.start();
  }

  /** For frequent events (mouse, selection, scroll): recomputes once per frame. */
  function requestUpdate() {
    // Off screen: does not measure or animate on every mouse move (the gaze catches up on return).
    if (state.disposed || queuedUpdate || !state.onScreen) return;
    queuedUpdate = requestAnimationFrame(() => {
      queuedUpdate = 0;
      update();
    });
  }

  function cancelQueuedUpdate() {
    cancelAnimationFrame(queuedUpdate);
    queuedUpdate = 0;
  }

  function dispose() {
    state.disposed = true;
    animator.dispose();
    cancelAnimationFrame(queuedUpdate);
    root.getAnimations().forEach((animation) => animation.cancel());
    hands.cancel();
    host.cancel();
    personality.cancel();
    renderer.lids.forEach((lid) => lid.getAnimations().forEach((animation) => animation.cancel()));
    window.clearTimeout(reasonTimer);
  }

  return {
    state,
    hands,
    reasons,
    animator,
    personality,
    host,
    eyeOverride: look.eyeOverride,
    move: body.move,
    stopBody: body.cancel,
    setReason,
    clearReason,
    toggleReason,
    update,
    requestUpdate,
    cancelQueuedUpdate,
    dispose,
  };
}
