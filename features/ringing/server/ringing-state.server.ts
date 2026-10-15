import { and, desc, eq, isNull } from "drizzle-orm";
import { incomingRings, outgoingRings } from "@/features/ringing/server/ring-service.server";
import { identitiesIn } from "@/features/room/server/livekit-gateway.server";
import { mediaRoomIn } from "@/features/room/server/session-store.server";
import { logger } from "@/server/logger.server";
import type { DbExecutor } from "@/server/db/index.server";
import { roomParticipations, rooms } from "@/server/db/schema";

/** The room of the call the person is in right now, from the open participation. */
export async function currentCallRoom(db: DbExecutor, userId: string): Promise<string | null> {
  const [row] = await db
    .select({ code: rooms.code })
    .from(roomParticipations)
    .innerJoin(rooms, eq(rooms.id, roomParticipations.roomId))
    .where(and(eq(roomParticipations.userId, userId), isNull(roomParticipations.leftAt)))
    .orderBy(desc(roomParticipations.joinedAt))
    .limit(1);
  return row?.code ?? null;
}

/**
 * The call room only if LiveKit still has the person in it. A participation left open by
 * a lost webhook (LiveKit restarted) would otherwise ring friends into an empty room.
 * Without an answer from LiveKit the participation is trusted, as before.
 */
export async function connectedCallRoom(db: DbExecutor, userId: string): Promise<string | null> {
  const code = await currentCallRoom(db, userId);
  if (!code) return null;
  try {
    const connected = await identitiesIn(await mediaRoomIn(db, code));
    return connected.includes(userId) ? code : null;
  } catch (error) {
    logger.warn({ err: error }, "could not confirm the caller's call with LiveKit");
    return code;
  }
}

/**
 * What every signed-in page needs for calls: the ring for this person (shown on any page),
 * the rings they started ("Chamando..." or "Ninguém atendeu") and the room they are in,
 * where "Chamar" brings a friend.
 */
export async function ringingState(db: DbExecutor, userId: string) {
  return {
    incoming: incomingRings(userId),
    outgoing: outgoingRings(userId),
    callRoom: await currentCallRoom(db, userId),
  };
}
