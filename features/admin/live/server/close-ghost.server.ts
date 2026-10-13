import { and, eq, isNull, lt, sql } from "drizzle-orm";
import type { Database, DbExecutor } from "@/server/db/index.server";
import { roomParticipations, rooms, shareSessions } from "@/server/db/schema";
import { lockRoomCodes } from "@/features/room/server/room-lifecycle.server";
import { closeShares, updatePeak } from "@/features/room/server/webhook/records.server";
import { GHOST_GRACE_MS, ghostRoomIds } from "@/features/admin/live/domain/ghost-rooms";

export interface ClosedGhost {
  id: string;
  code: string;
  /** People still listed in the room, now marked as gone. */
  people: number;
}

/**
 * Ends a room whose `room_finished` webhook never arrived, as that event would have:
 * the room, its participations and its shares end at the last activity seen (the best
 * estimate of when it really ended). New activity in LiveKit reopens it as usual.
 *
 * Takes the same per-code lock as webhook projection, and only closes a room that is
 * still quiet: an event that landed in the meantime means the room is not a ghost.
 * `adminId` is null when the server's own sweep closed it.
 */
export async function closeGhostRoom(
  tx: DbExecutor,
  room: { id: string; code: string },
  adminId: string | null,
  now = new Date(),
): Promise<ClosedGhost | null> {
  await lockRoomCodes(tx, [room.code]);
  const quietSince = new Date(now.getTime() - GHOST_GRACE_MS);
  const [closed] = await tx
    .update(rooms)
    .set({
      status: "finished",
      finishedAt: sql`greatest(${rooms.startedAt}, ${rooms.lastActivityAt})`,
      closedByAdminId: adminId,
    })
    .where(
      and(
        eq(rooms.id, room.id),
        eq(rooms.status, "active"),
        isNull(rooms.deletedAt),
        lt(rooms.lastActivityAt, quietSince),
      ),
    )
    .returning({ id: rooms.id, code: rooms.code, endedAt: rooms.finishedAt });
  if (!closed?.endedAt) return null;

  const gone = await tx
    .update(roomParticipations)
    .set({
      leftAt: sql`greatest(${roomParticipations.joinedAt}, ${closed.endedAt}::timestamptz)`,
      // The leave itself was never observed.
      leaveReason: "unknown",
    })
    .where(and(eq(roomParticipations.roomId, room.id), isNull(roomParticipations.leftAt)))
    .returning({ id: roomParticipations.id });
  await closeShares(tx, eq(shareSessions.roomId, room.id), closed.endedAt);
  await updatePeak(tx, room.id);
  return { id: room.id, code: room.code, people: gone.length };
}

/**
 * Ends, without an admin, every room gone from LiveKit and quiet for a while: LiveKit
 * restarting drops its rooms without `room_finished`, and until then the people in them
 * look "in a call" (rings go to their room, the pre-join counts them). `open` null means
 * LiveKit did not answer: then nothing is a ghost.
 */
export async function closeGhostRooms(
  db: Database,
  open: ReadonlySet<string> | null,
  now = new Date(),
): Promise<number> {
  if (!open) return 0;
  const live = await db
    .select({ id: rooms.id, code: rooms.code, lastActivityAt: rooms.lastActivityAt })
    .from(rooms)
    .where(and(eq(rooms.status, "active"), isNull(rooms.deletedAt)));
  const ghosts = ghostRoomIds(live, open, now.getTime());
  let closed = 0;
  for (const room of live.filter((candidate) => ghosts.has(candidate.id))) {
    const ghost = await db.transaction((tx) => closeGhostRoom(tx, room, null, now));
    if (ghost) closed += 1;
  }
  return closed;
}
