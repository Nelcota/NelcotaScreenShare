/** How long someone stays on the minimized card after they stop talking (short pauses). */
export const SPEAKER_HOLD_MS = 1500;

/** Faces the minimized card shows at once. */
export const MAX_SPEAKERS = 3;

/** When each person last spoke, by identity. */
export type LastSpoke = ReadonlyMap<string, number>;

/** Notes who is speaking now; everyone else keeps the time they last spoke. */
export function noteSpeakers(last: LastSpoke, speaking: readonly string[], now: number): LastSpoke {
  if (speaking.length === 0) return last;
  const next = new Map(last);
  for (const identity of speaking) next.set(identity, now);
  return next;
}

export interface SpeakerFaces {
  /** The faces to show, the most recent first, and whether each one is speaking now. */
  faces: { identity: string; speaking: boolean }[];
  /** Nobody has spoken yet in this call: the card shows the count instead. */
  nobodyYet: boolean;
}

/**
 * Who the minimized card shows: whoever spoke in the last moments (with the ring while they
 * speak), up to three; with nobody talking, the last one who spoke, without the ring.
 * Only people still in the call (`present`) count.
 */
export function speakerFaces(
  last: LastSpoke,
  speaking: readonly string[],
  present: readonly string[],
  now: number,
): SpeakerFaces {
  const inCall = new Set(present);
  const speakingNow = new Set(speaking);
  const byRecency = [...last.entries()]
    .filter(([identity]) => inCall.has(identity))
    .toSorted((a, b) => b[1] - a[1]);
  if (byRecency.length === 0) return { faces: [], nobodyYet: true };
  const recent = byRecency
    .filter(([identity, at]) => speakingNow.has(identity) || now - at < SPEAKER_HOLD_MS)
    .slice(0, MAX_SPEAKERS);
  const shown = recent.length > 0 ? recent : byRecency.slice(0, 1);
  return {
    faces: shown.map(([identity]) => ({ identity, speaking: speakingNow.has(identity) })),
    nobodyYet: false,
  };
}

/** When the next held face should leave, so the card can redraw then; none to wait for. */
export function nextExpiry(last: LastSpoke, speaking: readonly string[], now: number) {
  const speakingNow = new Set(speaking);
  const pending = [...last.entries()]
    .filter(([identity, at]) => !speakingNow.has(identity) && now - at < SPEAKER_HOLD_MS)
    .map(([, at]) => at + SPEAKER_HOLD_MS - now);
  return pending.length > 0 ? Math.min(...pending) : undefined;
}
