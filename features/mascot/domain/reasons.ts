import { PRIORITY, type Expression } from "./face";

/** Reasons that change the expression. Each lasts until a deadline or until it is removed. */
export type Reason =
  | "celebrate"
  | "error"
  | "capsLock"
  | "doubt"
  | "typing"
  | "sleep"
  | "interaction"
  | "host"
  | "context"
  | "curiosity";

/**
 * The active expression reasons, with deadlines. The expression shown is that of the
 * highest-priority reason (PRIORITY); with none, the resting one.
 */
export function createReasons(now: () => number = () => performance.now()) {
  const reasons = new Map<Reason, { expression: Expression; until: number }>();

  return {
    set(reason: Reason, expression: Expression, durationMs = Infinity) {
      reasons.set(reason, { expression, until: now() + durationMs });
    },
    /** Removes the reason; tells whether it existed. */
    delete(reason: Reason): boolean {
      return reasons.delete(reason);
    },
    /** Expression shown now (and discards expired reasons). */
    current(base: Expression): Expression {
      const time = now();
      let best = base;
      let bestRank = Number.POSITIVE_INFINITY;
      for (const [reason, entry] of reasons) {
        if (entry.until <= time) {
          reasons.delete(reason);
          continue;
        }
        const rank = PRIORITY.indexOf(entry.expression);
        if (rank !== -1 && rank < bestRank) {
          best = entry.expression;
          bestRank = rank;
        }
      }
      return best;
    },
    /** When the next reason expires (Infinity if none expires on its own). */
    nextExpiry(): number {
      return Math.min(...[...reasons.values()].map((entry) => entry.until));
    },
  };
}
