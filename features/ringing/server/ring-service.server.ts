import { incomingView, type Ring } from "@/features/ringing/domain/ring";
import { createRingStore } from "@/features/ringing/server/ring-store.server";
import { notifyUserWithData, notifyUsers } from "@/features/live/server/live-bus.server";

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

/**
 * One timer for the whole store, set to the next deadline: when a ring runs out the callee's
 * card goes away and the caller sees "Ninguém atendeu"; then the notice is cleared. Nothing
 * is left behind per ring or per person, whether it ended, was answered or was replaced.
 */
let sweepTimer: ReturnType<typeof setTimeout> | undefined;

function scheduleSweep() {
  clearTimeout(sweepTimer);
  sweepTimer = undefined;
  const deadline = ringStore.nextDeadline();
  if (deadline === null) return;
  sweepTimer = setTimeout(
    () => {
      ringStore.sweep();
      scheduleSweep();
    },
    Math.max(0, deadline - Date.now()) + 50,
  );
  sweepTimer.unref?.();
}

/** The callee's nudge carries the card, so it shows before their page reloads. */
export function startRing(input: RingInput): Ring {
  const ring = ringStore.start(input);
  scheduleSweep();
  nudge([ring.callerId]);
  notifyUserWithData(ring.calleeId, "ring", incomingView(ring));
  return ring;
}

export function cancelRing(ringId: string, callerId: string): Ring | null {
  const ring = ringStore.cancel(ringId, callerId);
  scheduleSweep();
  if (ring) nudge([ring.callerId, ring.calleeId]);
  return ring;
}

/** The callee's card goes away and the caller sees "<Nome> recusou" at once. */
export function declineRing(ringId: string, calleeId: string): Ring | null {
  const ring = ringStore.decline(ringId, calleeId);
  scheduleSweep();
  if (ring) nudge([ring.callerId, ring.calleeId]);
  return ring;
}

export function acceptRing(ringId: string, calleeId: string): Ring | null {
  const ring = ringStore.accept(ringId, calleeId);
  scheduleSweep();
  if (ring) nudge([ring.callerId, ring.calleeId]);
  return ring;
}

export const incomingRings = (userId: string) => ringStore.incomingFor(userId);
export const outgoingRings = (userId: string) => ringStore.outgoingFrom(userId);
