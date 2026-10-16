import { IDLE, type Gaze } from "./eye-tracking";
import type { Expression, FaceState } from "./face";
import type { MascotActivity, MascotTemperament } from "./personality";
import type { Reason } from "./reasons";

/**
 * Mascot rules that depend only on the current expression, each named and
 * covered by tests/unit/mascot-rules.test.ts.
 */

const SLEEPING: ReadonlySet<Expression> = new Set(["sleepy", "asleep"]);
/** Angry or worried: the error face rules, with no play on top. */
const UPSET: ReadonlySet<Expression> = new Set(["grumpy", "worried"]);

/** Sleepy or asleep: still gaze, slow eyelids and body. */
export function isSleeping(expression: Expression): boolean {
  return SLEEPING.has(expression);
}

/** Expressions that prevent (and interrupt) petting, sneezing and the like. */
export function blocksPlay(expression: Expression): boolean {
  return UPSET.has(expression) || expression === "skeptical" || expression === "asleep";
}

/**
 * Petting and high fives can interrupt quiet rest or the home pair's walk.
 */
export function allowsPlay(activity: MascotActivity): boolean {
  return activity === "idle" || activity === "walking";
}

/** Blink only with open, calm eyes. */
export function canBlink(expression: Expression): boolean {
  return !isSleeping(expression) && !UPSET.has(expression);
}

/** Wave on mouse hover: not with an error face. */
export function canGreet(expression: Expression): boolean {
  return !UPSET.has(expression);
}

/** Occasional sneeze: only at quiet rest. */
export function canSneeze(expression: Expression): boolean {
  return expression === "neutral" || expression === "happy" || expression === "curious";
}

/**
 * The home page pair only starts walking if neither is busy with one of these
 * (or with a gesture other than the "high five" itself).
 */
const PAIR_BUSY_EXPRESSIONS: readonly Expression[] = [
  "asleep",
  "sleepy",
  "yawning",
  "grumpy",
  "worried",
  "skeptical",
];

/** CSS selector for busy mascots within the pair (see PAIR_BUSY_EXPRESSIONS). */
export const PAIR_BUSY_SELECTOR = [
  '[data-gesture]:not([data-gesture="highFive"])',
  ...PAIR_BUSY_EXPRESSIONS.map((expression) => `[data-expression="${expression}"]`),
].join(", ");

/** Where to look besides the pointer and focus. */
export type GazeFocus = "idle" | "partner" | "stage" | "participants" | "free";

export function gazeFocus(expression: Expression): GazeFocus {
  if (isSleeping(expression)) return "idle";
  if (expression === "greeting" || expression === "walking" || expression === "noticing") {
    return "partner";
  }
  if (expression === "welcoming") return "participants";
  if (expression === "presenting") return "stage";
  return "free";
}

/** Critically damped springs (no bounce); "response" in seconds, as Apple does it. */
export const GAZE_RESPONSE = 0.14;
const FACE_RESPONSE = 0.32;
const SLEEP_RESPONSE = 0.85;

/** While sleeping, eyelids, head and body settle slowly; everything else stays normal. */
export function faceResponse(expression: Expression, key: keyof FaceState): number {
  return isSleeping(expression) && key !== "pupil" ? SLEEP_RESPONSE : FACE_RESPONSE;
}

/** "Waiting": gaze slowly drifting back and forth, side to side. */
export function waitingGaze(time: number): Gaze {
  const x = Math.sin(time / 1100) * 0.55;
  return { ...IDLE, x, leftX: x, rightX: x };
}

/** "Listening": tilts the head and opens the eyes according to the voice (0–1). */
export function listeningFace(face: FaceState, voice: number): FaceState {
  return { ...face, tilt: -4 + voice * 7, pupil: 1 + voice * 0.05 };
}

/** The calm partner relaxes its posture; task, error and password poses stay intact. */
export function temperamentFace(
  face: FaceState,
  expression: Expression,
  temperament: MascotTemperament,
): FaceState {
  if (temperament !== "calm") return face;
  if (!["neutral", "curious", "noticing", "walking", "greeting"].includes(expression)) return face;
  return {
    ...face,
    tilt: face.tilt + 3,
    lid0: Math.max(face.lid0, 0.15),
    lid1: Math.max(face.lid1, 0.15),
    rest: 0.1,
  };
}

/** Eyelid during a 180 ms blink (0 open → 1 closed → 0). */
export const BLINK_MS = 180;
export function blinkLid(progress: number): number {
  return progress < 1 ? Math.sin(progress * Math.PI) ** 2 : 0;
}

/** Interval until the next blink (random to look natural). */
export function nextBlinkIn(random = Math.random()): number {
  return 2500 + random * 3500;
}

/** How long it looks at something that asked for attention (e.g. the error alert). */
export const ATTENTION_MS = 1500;
/** Keeps the error face until the person types again (or until this time passes). */
const UPSET_MS = 4000;
export const HAPPY_AFTER_TYPING_MS = 2000;
const CELEBRATE_MS = 1600;
/** Minimum interval between two waves on mouse hover. */
export const GREETING_COOLDOWN_MS = 2500;

/** Screen signals (events.ts) translated into expression and motion changes. */
export interface SignalReaction {
  clear: Reason[];
  set?: { reason: Reason; expression: Expression; durationMs?: number };
  /** Undoes "doubt" (doubt signal turned off). */
  unset?: Reason;
  motion?: "jump" | "shake" | "nod";
  wave?: "celebrate" | "simple";
  /** Stops the wave and the current motion before reacting. */
  stopGestures?: boolean;
  /** Looks at the signal's element for a moment. */
  lookAtTarget?: boolean;
}

export type MascotSignal =
  /** It worked: a little jump of joy. */
  | { type: "celebrate" }
  /**
   * It failed. `grumpy`: error caused by the attempt (frowns and shakes its head);
   * `worried`: everything else (gets worried about the person). `target`: where it looks.
   */
  | { type: "upset"; mood: "grumpy" | "worried"; target?: Element | undefined }
  /** Suspicious (e.g. an email that looks mistyped) until `active` turns false again. */
  | { type: "doubt"; active: boolean }
  /** Approving nod (e.g. the email is complete). */
  | { type: "nod" };

export function reactionTo(signal: MascotSignal): SignalReaction {
  switch (signal.type) {
    case "celebrate":
      return {
        clear: ["error"],
        set: { reason: "celebrate", expression: "celebrate", durationMs: CELEBRATE_MS },
        motion: "jump",
        wave: "celebrate",
      };
    case "upset":
      return {
        clear: ["celebrate", "typing"],
        stopGestures: true,
        lookAtTarget: true,
        set: { reason: "error", expression: signal.mood, durationMs: UPSET_MS },
        ...(signal.mood === "grumpy" ? { motion: "shake" as const } : {}),
      };
    case "doubt":
      return signal.active
        ? { clear: [], set: { reason: "doubt", expression: "skeptical" } }
        : { clear: [], unset: "doubt" };
    case "nod":
      return { clear: [], motion: "nod", wave: "simple" };
  }
}
