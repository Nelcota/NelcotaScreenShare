/** A just-created room may not be in LiveKit's list yet (or its webhook may be late). */
export const GHOST_GRACE_MS = 2 * 60 * 1000;

interface LiveRoomActivity {
  id: string;
  code: string;
  lastActivityAt: Date;
}

/**
 * Rooms the panel shows as live but LiveKit no longer has: their `room_finished`
 * webhook never arrived. Without LiveKit's list (`null`) nothing can be called a ghost.
 */
export function ghostRoomIds(
  rooms: readonly LiveRoomActivity[],
  liveKitRoomNames: ReadonlySet<string> | null,
  now = Date.now(),
): Set<string> {
  if (!liveKitRoomNames) return new Set();
  const ghosts = rooms.filter(
    (room) =>
      !liveKitRoomNames.has(room.code) && now - room.lastActivityAt.getTime() > GHOST_GRACE_MS,
  );
  return new Set(ghosts.map((room) => room.id));
}
