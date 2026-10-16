/**
 * A call rings with sound for a minute, then stays on screen in silence for half a minute
 * before it ends: 90 s in all, for every call, group included.
 */
export const RING_SOUND_MS = 60_000;
const RING_SILENT_MS = 30_000;
export const RING_DURATION_MS = RING_SOUND_MS + RING_SILENT_MS;

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
