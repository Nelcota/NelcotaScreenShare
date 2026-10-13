import type { Ring } from "@/features/ringing/domain/ring";
import { createRingStore } from "@/features/ringing/server/ring-store.server";
import { notifyUsers } from "@/features/live/server/live-bus.server";

/** Both sides reload: the card appears, changes or goes away. */
function nudge(userIds: readonly string[]) {
  notifyUsers(userIds, "ring");
}

/**
 * Calls ringing now. A ring found over by any read (a page loading, the timer) tells both
 * sides, so the caller always gets "Ninguém atendeu".
 */
const ringStore = createRingStore(Date.now, (ended) => nudge([ended.callerId, ended.calleeId]));

type RingInput = Parameters<typeof ringStore.start>[0];

/** When the time runs out, the callee's card goes away and the caller sees "Ninguém atendeu". */
function scheduleEnd(ring: Ring) {
  const timer = setTimeout(() => ringStore.sweep(), Math.max(0, ring.expiresAt - Date.now()) + 50);
  timer.unref?.();
}

export function startRing(input: RingInput): Ring {
  const ring = ringStore.start(input);
  scheduleEnd(ring);
  nudge([ring.callerId, ring.calleeId]);
  return ring;
}

export function cancelRing(ringId: string, callerId: string): Ring | null {
  const ring = ringStore.cancel(ringId, callerId);
  if (ring) nudge([ring.callerId, ring.calleeId]);
  return ring;
}

/** The callee's card goes away and the caller sees "<Nome> recusou" at once. */
export function declineRing(ringId: string, calleeId: string): Ring | null {
  const ring = ringStore.decline(ringId, calleeId);
  if (ring) nudge([ring.callerId, ring.calleeId]);
  return ring;
}

export function acceptRing(ringId: string, calleeId: string): Ring | null {
  const ring = ringStore.accept(ringId, calleeId);
  if (ring) nudge([ring.callerId, ring.calleeId]);
  return ring;
}

export const incomingRings = (userId: string) => ringStore.incomingFor(userId);
export const outgoingRings = (userId: string) => ringStore.outgoingFrom(userId);
