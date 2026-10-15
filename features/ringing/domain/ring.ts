/**
 * A call rings with sound for a minute, then stays on screen in silence for half a minute
 * before it ends: 90 s in all, for every call, group included.
 */
export const RING_SOUND_MS = 60_000;
const RING_SILENT_MS = 30_000;
export const RING_DURATION_MS = RING_SOUND_MS + RING_SILENT_MS;

/** What the caller reads when the server restarted mid-ring. */
export const DROPPED_CALL = "A chamada caiu. Chame de novo.";

/** How long "Ninguém atendeu" or "<Nome> recusou" stays available to the caller. */
export const MISSED_NOTICE_MS = 15_000;

export interface Ring {
  id: string;
  callerId: string;
  callerName: string;
  calleeId: string;
  calleeName: string;
  roomCode: string;
  /** Set when the whole group was called from a conversation. */
  conversationId: string | null;
  startedAt: number;
  expiresAt: number;
}

/** What the callee sees: who calls and until when. */
export interface IncomingRing {
  id: string;
  callerId: string;
  callerName: string;
  roomCode: string;
  startedAt: number;
  expiresAt: number;
}

/** What the caller sees: still ringing, nobody answered or the friend declined. */
export interface OutgoingRing {
  id: string;
  calleeId: string;
  calleeName: string;
  state: "ringing" | "missed" | "declined";
}

export function isRinging(ring: Pick<Ring, "expiresAt">, now: number): boolean {
  return ring.expiresAt > now;
}

/** The sound plays only during the first part; the card stays silent until the end. */
export function ringSoundLeft(ring: Pick<Ring, "startedAt">, now: number): number {
  return Math.max(0, ring.startedAt + RING_SOUND_MS - now);
}

/** The ring as the callee sees it: never who else was rung or the conversation. */
export function incomingView(ring: Ring): IncomingRing {
  const { id, callerId, callerName, roomCode, startedAt, expiresAt } = ring;
  return { id, callerId, callerName, roomCode, startedAt, expiresAt };
}

const firstWord = (name: string) => name.trim().split(" ")[0] ?? name;

/**
 * The line under "Você é a primeira pessoa aqui" while you call someone: "Chamando Bia…"
 * with a way to cancel, then "Bia não atendeu" or "Bia recusou" while the server keeps it.
 */
export function ringStatusLine(outgoing: readonly OutgoingRing[]): {
  text: string;
  cancel: { ringId: string; calleeId: string } | null;
} | null {
  const ringing = outgoing.findLast((ring) => ring.state === "ringing");
  if (ringing) {
    const cancel = { ringId: ringing.id, calleeId: ringing.calleeId };
    return { text: `Chamando ${firstWord(ringing.calleeName)}…`, cancel };
  }
  const ended = outgoing.at(-1);
  if (!ended) return null;
  const name = firstWord(ended.calleeName);
  const text = ended.state === "declined" ? `${name} recusou` : `${name} não atendeu`;
  return { text, cancel: null };
}
