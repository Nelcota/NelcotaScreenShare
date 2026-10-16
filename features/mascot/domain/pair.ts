import type { MascotActivity, MascotTemperament } from "./personality";

/**
 * The curious mascot invites its calm partner, who answers before they walk to the middle.
 * Both arrive before the high five, celebrate in their own way and walk back.
 */
export type PairPhase =
  | "rest"
  | "invite"
  | "answer"
  | "approach"
  | "ready"
  | "hit"
  | "cheer"
  | "return";

export const PAIR_STEP_MS = {
  invite: 700,
  answer: 500,
  walk: 3200,
  ready: 450,
  hit: 450,
  cheer: 1000,
} as const;

/** Real rest between meetings; the variation avoids mechanical repetition. */
export function nextPairRest(random = Math.random()): number {
  return 6000 + random * 4000;
}

/** What each mascot of the pair is doing in each phase (opening the room: waiting). */
export function pairActivity(
  phase: PairPhase,
  pending: boolean,
  temperament: MascotTemperament = "curious",
): MascotActivity {
  if (pending) return "waiting";
  if (phase === "invite") return temperament === "curious" ? "greeting" : "noticing";
  if (phase === "answer") return temperament === "calm" ? "greeting" : "noticing";
  if (phase === "ready" || phase === "hit" || phase === "cheer") return "greeting";
  if (phase === "approach" || phase === "return") return "walking";
  return "idle";
}
