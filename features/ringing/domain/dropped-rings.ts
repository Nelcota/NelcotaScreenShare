import type { OutgoingRing } from "@/features/ringing/domain/ring";

/** What the caller's page knew: the rings going out, from a server that started at a time. */
export interface OutgoingSnapshot {
  serverStart: number;
  outgoing: readonly OutgoingRing[];
}

/**
 * Rings that were still ringing and vanished because the server restarted (rings live in
 * memory). On the same server a ring that goes away was answered or cancelled instead.
 */
export function droppedRings(
  before: OutgoingSnapshot | null,
  now: OutgoingSnapshot,
): OutgoingRing[] {
  if (!before || before.serverStart === now.serverStart) return [];
  const still = new Set(now.outgoing.map((ring) => ring.id));
  return before.outgoing.filter((ring) => ring.state === "ringing" && !still.has(ring.id));
}
