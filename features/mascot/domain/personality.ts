import { JUMP, PET, SNEEZE, STRETCH, type Motion } from "./body-motions";
import type { Expression } from "./face";
import type { createHandMotions } from "@/features/mascot/client/hand-motions";

export type MascotActivity =
  | "idle"
  | "waiting"
  /** Something went wrong around it (the call is reconnecting): worried until it passes. */
  | "worried"
  | "listening"
  | "presenting"
  | "walking"
  | "noticing"
  | "greeting";
export type MascotTemperament = "curious" | "calm";
export type Gesture = "pet" | "highFive" | "highFiveHit" | "yawn" | "stretch" | "sneeze";

/** Ignores low noise; invalid inputs never reach the springs or the CSS. */
export function voiceAmount(level: number): number {
  return Number.isFinite(level) ? Math.min(1, Math.max(0, (level - 0.06) / 0.7)) : 0;
}

interface PersonalityOptions {
  root: HTMLElement;
  hands: ReturnType<typeof createHandMotions>;
  react: (expression: Expression | undefined) => void;
  move: (motion: Motion) => unknown;
  stopMotion?: () => void;
  available: () => boolean;
  now?: () => number;
  schedule?: (callback: () => void, delay: number) => number;
  unschedule?: (timer: number) => void;
}

/** Interruptible gestures: one routine at a time, no orphan timers or queues of play. */
export function createPersonality({
  root,
  hands,
  react,
  move,
  stopMotion = () => {},
  available,
  now = () => performance.now(),
  schedule = (callback, delay) => window.setTimeout(callback, delay),
  unschedule = (timer) => window.clearTimeout(timer),
}: PersonalityOptions) {
  const timers = new Set<number>();
  let gesture: Gesture | undefined;
  let nextOfferAt = 0;

  function later(delay: number, callback: () => void) {
    const timer = schedule(() => {
      timers.delete(timer);
      callback();
    }, delay);
    timers.add(timer);
  }

  function cancel() {
    for (const timer of timers) unschedule(timer);
    timers.clear();
    gesture = undefined;
    delete root.dataset.gesture;
    delete root.dataset.highFive;
    hands.cancel();
    stopMotion();
    react(undefined);
  }

  function begin(next: Gesture, expression: Expression, duration: number) {
    if (!available()) return false;
    cancel();
    gesture = next;
    root.dataset.gesture = next;
    react(expression);
    later(duration, cancel);
    return true;
  }

  function offerHighFive(force = false) {
    if (!force && now() < nextOfferAt) return false;
    if (!begin("highFive", "highFive", 7000)) return false;
    nextOfferAt = now() + 20_000;
    root.dataset.highFive = "true";
    hands.hold();
    return true;
  }

  return {
    get active() {
      return gesture;
    },
    cancel,
    pet() {
      if (begin("pet", "pet", 1400)) move(PET);
    },
    offerHighFive,
    highFive() {
      if (gesture !== "highFive") {
        offerHighFive(true);
        return;
      }
      if (begin("highFiveHit", "celebrate", 1100)) {
        move(JUMP);
        hands.wave(true);
      }
    },
    yawn() {
      if (!begin("yawn", "yawning", 2200)) return;
      later(1200, () => {
        react("stretching");
        move(STRETCH);
      });
    },
    stretch() {
      if (begin("stretch", "stretching", 1200)) move(STRETCH);
    },
    sneeze() {
      if (!begin("sneeze", "ticklish", 1900)) return;
      later(650, () => {
        react("sneezing");
        move(SNEEZE);
      });
      later(1100, () => react("surprised"));
    },
  };
}
