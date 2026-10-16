import { randomUUID } from "node:crypto";
import {
  incomingView,
  type IncomingRing,
  isRinging,
  MISSED_NOTICE_MS,
  RING_DURATION_MS,
  type OutgoingRing,
  type Ring,
} from "@/features/ringing/domain/ring";

type RingInput = Omit<Ring, "id" | "startedAt" | "expiresAt">;

/** "Ninguém atendeu" or "<Nome> recusou", kept for the caller for a short while. */
interface EndNotice {
  id: string;
  callerId: string;
  calleeId: string;
  calleeName: string;
  state: "missed" | "declined";
  until: number;
}

/**
 * Calls ringing right now, in memory: enough for a single instance, like presence
 * (docs/development.md). A decline ends the ring for both sides at once, so the caller sees
 * "<Nome> recusou" right away.
 */
export function createRingStore(
  now: () => number = Date.now,
  /** Told once for every ring that runs out, whichever read finds it over. */
  onEnded: (ring: Ring) => void = () => {},
) {
  const rings = new Map<string, Ring>();
  const notices = new Map<string, EndNotice>();

  function leaveNotice(ring: Ring, state: EndNotice["state"], time: number) {
    const { id, callerId, calleeId, calleeName } = ring;
    notices.set(id, { id, callerId, calleeId, calleeName, state, until: time + MISSED_NOTICE_MS });
  }

  /** Ends what ran out of time; both sides are told through onEnded. */
  function sweep(): Ring[] {
    const time = now();
    const ended: Ring[] = [];
    for (const [id, ring] of rings) {
      if (isRinging(ring, time)) continue;
      rings.delete(id);
      ended.push(ring);
      leaveNotice(ring, "missed", time);
      onEnded(ring);
    }
    for (const [id, notice] of notices) if (notice.until <= time) notices.delete(id);
    return ended;
  }

  /** Rings the callee; a ring from the same caller to the same person is replaced. */
  function start(input: RingInput): Ring {
    sweep();
    for (const [id, ring] of rings) {
      if (ring.callerId === input.callerId && ring.calleeId === input.calleeId) {
        rings.delete(id);
      }
    }
    const startedAt = now();
    const ring: Ring = {
      ...input,
      id: randomUUID(),
      startedAt,
      expiresAt: startedAt + RING_DURATION_MS,
    };
    rings.set(ring.id, ring);
    return ring;
  }

  /** The caller stops it; null when it was not theirs or already ended. */
  function cancel(ringId: string, callerId: string): Ring | null {
    sweep();
    const ring = rings.get(ringId);
    if (!ring || ring.callerId !== callerId) return null;
    rings.delete(ringId);
    return ring;
  }

  /** The caller left the call: every ring they started into it stops, with no notice. */
  function cancelFromRoom(callerId: string, roomCode: string): Ring[] {
    sweep();
    const stopped = [...rings.values()].filter(
      (ring) => ring.callerId === callerId && ring.roomCode === roomCode,
    );
    for (const ring of stopped) rings.delete(ring.id);
    return stopped;
  }

  /** The callee says no: the ring ends for both and the caller is told who declined. */
  function decline(ringId: string, calleeId: string): Ring | null {
    sweep();
    const ring = rings.get(ringId);
    if (!ring || ring.calleeId !== calleeId) return null;
    rings.delete(ringId);
    leaveNotice(ring, "declined", now());
    return ring;
  }

  /** The callee goes in: the ring ends for both. */
  function accept(ringId: string, calleeId: string): Ring | null {
    sweep();
    const ring = rings.get(ringId);
    if (!ring || ring.calleeId !== calleeId) return null;
    rings.delete(ringId);
    return ring;
  }

  function incomingFor(calleeId: string): IncomingRing[] {
    sweep();
    return [...rings.values()]
      .filter((ring) => ring.calleeId === calleeId)
      .map(incomingView)
      .toSorted((one, other) => other.startedAt - one.startedAt);
  }

  function outgoingFrom(callerId: string): OutgoingRing[] {
    sweep();
    const ringing = [...rings.values()]
      .filter((ring) => ring.callerId === callerId)
      .map((ring) => ({
        id: ring.id,
        calleeId: ring.calleeId,
        calleeName: ring.calleeName,
        state: "ringing" as const,
      }));
    const gone = [...notices.values()]
      .filter((notice) => notice.callerId === callerId)
      .map(({ id, calleeId, calleeName, state }) => ({ id, calleeId, calleeName, state }));
    return [...ringing, ...gone];
  }

  /** When the next ring runs out or the next notice goes away; null when nothing is left. */
  function nextDeadline(): number | null {
    const deadlines = [
      ...[...rings.values()].map((ring) => ring.expiresAt),
      ...[...notices.values()].map((notice) => notice.until),
    ];
    if (deadlines.length === 0) return null;
    return Math.min(...deadlines);
  }

  return {
    start,
    cancel,
    cancelFromRoom,
    decline,
    accept,
    incomingFor,
    outgoingFrom,
    sweep,
    nextDeadline,
  };
}
