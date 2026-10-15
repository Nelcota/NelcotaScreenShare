import { and, eq, isNull } from "drizzle-orm";
import { canBeCalled } from "@/features/friends/domain/presence-status";
import { shownStatuses } from "@/features/friends/server/presence-status.server";
import { canMessage } from "@/features/messages/server/conversations.server";
import { managesRoomAccess } from "@/features/room/domain/room-access";
import { identitiesIn } from "@/features/room/server/livekit-gateway.server";
import { roomRoleOf } from "@/features/room/server/room-roles.server";
import { mediaRoomIn } from "@/features/room/server/session-store.server";
import { logger } from "@/server/logger.server";
import type { DbExecutor } from "@/server/db/index.server";
import { roomParticipations, rooms } from "@/server/db/schema";

/** Someone still connected to the room's call. */
export async function inCall(db: DbExecutor, roomCode: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: roomParticipations.id })
    .from(roomParticipations)
    .innerJoin(rooms, eq(rooms.id, roomParticipations.roomId))
    .where(
      and(
        eq(rooms.code, roomCode),
        eq(roomParticipations.userId, userId),
        isNull(roomParticipations.leftAt),
      ),
    )
    .limit(1);
  return row !== undefined;
}

/** Connected by LiveKit's own count: right after joining, before the webhook records it. */
async function connectedInLiveKit(db: DbExecutor, roomCode: string, userId: string) {
  try {
    return (await identitiesIn(await mediaRoomIn(db, roomCode))).includes(userId);
  } catch (error) {
    logger.warn({ err: error }, "could not ask LiveKit who is in the call");
    return false;
  }
}

/** Who may bring a friend into a room by ringing: its owner, a moderator or someone in the call. */
export async function mayRingInto(
  db: DbExecutor,
  roomCode: string,
  userId: string,
): Promise<boolean> {
  if (managesRoomAccess(await roomRoleOf(db, { roomCode, userId }))) return true;
  if (await inCall(db, roomCode, userId)) return true;
  return connectedInLiveKit(db, roomCode, userId);
}

/**
 * Whether a friend can be rung right now: still friends without a block, and Online or
 * Ausente as their friends see them (Não perturbe, Invisível and Offline do not ring).
 */
export async function canRing(
  db: DbExecutor,
  callerId: string,
  calleeId: string,
  roomCode: string,
) {
  if (callerId === calleeId) return false;
  // Already in the room: nothing to ring for.
  if (await inCall(db, roomCode, calleeId)) return false;
  if (!(await canMessage(db, callerId, calleeId))) return false;
  const status = (await shownStatuses(db, [calleeId])).get(calleeId) ?? "offline";
  return canBeCalled(status);
}
