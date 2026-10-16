import { nextPairRest, PAIR_STEP_MS, type PairPhase } from "./pair";

export interface PairGeometry {
  width: number;
  size: number;
}

const TIMED_PHASES: Partial<Record<PairPhase, { next: PairPhase; wait: number }>> = {
  invite: { next: "answer", wait: PAIR_STEP_MS.answer },
  answer: { next: "approach", wait: 0 },
  ready: { next: "hit", wait: PAIR_STEP_MS.hit },
  cheer: { next: "return", wait: 0 },
};

/** Real positions and phases share one clock; only arrival allows the greeting. */
export function createPairMotion(random: () => number = Math.random) {
  let geometry: PairGeometry | undefined;
  let phase: PairPhase = "rest";
  let visitor = 0;
  let resident = 0;
  let remaining = nextPairRest(random());
  let suspended = false;

  function landmarks() {
    const { width, size } = geometry ?? { width: 0, size: 0 };
    const meeting = width / 2 - size * 0.39;
    const home = Math.max(size / 2, Math.min(width * 0.16, meeting));
    return { width, size, meeting, home };
  }

  function targets() {
    const { width, size, meeting, home } = landmarks();
    if (phase === "return" || phase === "rest" || phase === "invite" || phase === "answer") {
      return [home, width - home] as const;
    }
    const gap = phase === "approach" || phase === "ready" ? size * 0.04 : 0;
    return [meeting - gap, width - meeting + gap] as const;
  }

  function arrived() {
    const [left, right] = targets();
    return Math.abs(visitor - left) < 0.001 && Math.abs(resident - right) < 0.001;
  }

  function change(next: PairPhase, wait = 0) {
    phase = next;
    remaining = wait;
  }

  function move(elapsed: number) {
    const { size, meeting, home } = landmarks();
    const speed =
      phase === "hit" ? (size * 0.04) / 180 : Math.abs(meeting - home) / PAIR_STEP_MS.walk;
    const distance = Math.max(0.02, speed) * elapsed;
    const [left, right] = targets();
    const toward = (value: number, target: number, pace = 1) =>
      value + Math.sign(target - value) * Math.min(Math.abs(target - value), distance * pace);
    visitor = toward(visitor, left, phase === "hit" ? 1 : 1.15);
    resident = toward(resident, right);
  }

  function progressPhase(canApproach: boolean) {
    const timed = TIMED_PHASES[phase];
    if (timed) {
      if (!remaining) change(timed.next, timed.wait);
      return;
    }
    switch (phase) {
      case "rest":
        if (!remaining && canApproach) change("invite", PAIR_STEP_MS.invite);
        break;
      case "approach":
        if (arrived()) change("ready", PAIR_STEP_MS.ready);
        break;
      case "hit":
        if (!remaining && arrived()) change("cheer", PAIR_STEP_MS.cheer);
        break;
      case "return":
        if (arrived()) change("rest", nextPairRest(random()));
        break;
    }
  }

  return {
    get state() {
      return { phase, visitor, resident, suspended };
    },
    /** Only uses frames while moving; rest and poses use a timer. */
    get nextIn() {
      if (phase === "approach" || phase === "return" || (phase === "hit" && !arrived())) return 0;
      return Math.max(remaining, 100);
    },
    resize(next: PairGeometry) {
      if (geometry?.width === next.width && geometry.size === next.size) return;
      const initial = !geometry;
      geometry = next;
      if (initial || phase === "rest") {
        [visitor, resident] = targets();
        return;
      }
      if (phase === "ready") {
        change("approach");
        return;
      }
      if (phase !== "approach" && phase !== "return") change("return");
    },
    suspend(value: boolean) {
      suspended = value;
    },
    retreat() {
      if (phase !== "rest" && phase !== "return") change("return");
    },
    advance(elapsed: number, canApproach: boolean) {
      if (suspended || !geometry) return;
      const elapsedSeconds = Math.max(0, elapsed);
      if (phase === "approach" || phase === "return" || phase === "hit") move(elapsedSeconds);
      remaining = Math.max(0, remaining - elapsedSeconds);
      progressPhase(canApproach);
    },
  };
}
