import type { Reason } from "@/features/mascot/domain/reasons";
import { allowsPlay, canBlink, canSneeze, isSleeping } from "@/features/mascot/domain/rules";
import { prefersReducedMotion } from "@/lib/animation/motion";
import type { FaceRenderer } from "./face-renderer";
import { startAmbient } from "./ambient";
import { createMascotCore, type MascotInputs } from "./mascot-core";
import { listenToSignals } from "./signals";
import { subscribePageInput } from "./page-input";
import { createSleepClock } from "./sleep-clock";
import { pageReactions } from "./page-reactions";
import { attachTouch } from "./touch";

export type { MascotInputs } from "./mascot-core";

type MascotCore = ReturnType<typeof createMascotCore>;

/** Blinks and sneezes on their own while the mascot is free. */
function startMascotAmbient({ state, animator, personality, eyeOverride, update }: MascotCore) {
  return startAmbient({
    canBlink: () =>
      !prefersReducedMotion() &&
      !document.hidden &&
      state.onScreen &&
      canBlink(state.current) &&
      !eyeOverride(),
    blink: () => {
      animator.blink();
      update();
    },
    canSneeze: () =>
      !state.disposed &&
      !prefersReducedMotion() &&
      !personality.active &&
      canSneeze(state.current) &&
      !(document.activeElement instanceof HTMLInputElement) &&
      !(document.activeElement instanceof HTMLTextAreaElement),
    sneeze: () => personality.sneeze(),
  });
}

/**
 * The mascot's behavior: combines what happens on screen (mouse, focus,
 * typing, system signals) into an expression and a gaze, and animates the face.
 *
 * - Expression: reasons with deadline and priority (domain/reasons.ts).
 * - Per-expression rules: domain/rules.ts.
 * - Gaze: screen geometry (client/gaze.ts). Drawing: client/face-animator.ts.
 */
export function createMascotController(
  root: HTMLElement,
  face: HTMLElement,
  renderer: FaceRenderer,
  inputs: MascotInputs,
) {
  const core = createMascotCore(root, face, renderer, inputs, () => signals.attentionTarget());
  const { state, hands, reasons, animator, personality, host, move } = core;
  const { setReason, clearReason, toggleReason, update } = core;
  const dropReason = (reason: Reason) => void reasons.delete(reason);
  let pendingHost: { kind: "welcome" | "presenting"; until: number } | undefined;

  function cueHost(kind: "welcome" | "presenting") {
    if (document.hidden) return;
    // A first arrival or share also reveals the corner; let its observer catch up.
    if (!state.onScreen) {
      pendingHost = { kind, until: performance.now() + 1500 };
      return;
    }
    pendingHost = undefined;
    onActivity();
    personality.cancel();
    if (kind === "presenting") {
      host.present();
      return;
    }
    host.welcome();
  }

  const signals = listenToSignals({
    personality,
    hands,
    host,
    onActivity,
    dropReason,
    setReason,
    clearReason,
    move,
    stopBody: core.stopBody,
    update,
  });

  const sleep = createSleepClock({
    personality,
    canSleep: () =>
      inputs.canSleep() && inputs.activity() === "idle" && !document.hidden && state.onScreen,
    setSleep: (expression) => setReason("sleep", expression),
    dropSleep: () => reasons.delete("sleep"),
    clearSleep: () => clearReason("sleep"),
    update,
  });

  function onActivity() {
    sleep.activity();
  }

  const touch = attachTouch({
    root,
    hands,
    personality,
    move,
    onActivity,
    current: () => state.current,
    activity: inputs.activity,
    visible: () => state.onScreen && !document.hidden,
    sleeping: () => isSleeping(state.current),
    temperament: () => inputs.temperament?.() ?? "curious",
  });

  const stopPageInput = subscribePageInput(
    pageReactions({
      root,
      personality,
      activity: inputs.activity,
      setReason,
      clearReason,
      dropReason,
      setPointer: (next) => {
        state.pointer = next;
      },
      update,
      requestUpdate: core.requestUpdate,
      onActivity,
      pauseMotion,
    }),
  );

  // Pauses animations off screen or with the tab hidden.
  function pauseMotion() {
    pendingHost = undefined;
    root.dataset.motion = "paused";
    animator.pause();
    core.cancelQueuedUpdate();
    touch.cancelPress();
    core.stopBody();
    personality.cancel();
    host.cancel();
    hands.cancel();
    sleep.stop();
  }

  sleep.check();
  update();

  /** The activity changed (walking, presenting…): the context expression follows. */
  let previousActivity: ReturnType<MascotInputs["activity"]> | undefined;
  function syncContext() {
    const nextActivity = inputs.activity();
    if (previousActivity === nextActivity) return;
    previousActivity = nextActivity;
    pendingHost = undefined;
    host.cancel();
    // A pat or "high five" in progress survives the pair's walk; anything else interrupts it.
    if (!allowsPlay(nextActivity)) personality.cancel();
    if (nextActivity !== "idle") {
      sleep.forget();
      reasons.delete("curiosity");
    }
    toggleReason("context", nextActivity === "idle" ? undefined : nextActivity);
    update();
    if (nextActivity === "presenting") cueHost("presenting");
    sleep.check();
  }
  syncContext();
  touch.greetWhenReady();

  const stopAmbient = startMascotAmbient(core);

  const visibility = new IntersectionObserver(([entry]) => {
    state.onScreen = entry?.isIntersecting ?? true;
    if (!state.onScreen) {
      pauseMotion();
      return;
    }
    onActivity();
    update();
    const pending = pendingHost;
    pendingHost = undefined;
    if (pending && performance.now() < pending.until) cueHost(pending.kind);
  });
  visibility.observe(root);

  return {
    /** The resting expression changed. */
    update,
    syncContext,
    welcome: () => cueHost("welcome"),
    /** Sleep was turned on or off: turned off mid-nap, it wakes up immediately. */
    resetSleep() {
      if (!inputs.canSleep() && reasons.delete("sleep")) update();
      sleep.restart();
    },
    dispose() {
      core.dispose();
      sleep.stop();
      stopAmbient();
      visibility.disconnect();
      signals.stop();
      stopPageInput();
      touch.detach();
    },
  };
}
