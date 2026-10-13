import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { DbExecutor } from "@/server/db/index.server";
import {
  roomBans,
  roomJoinRequests,
  roomRoles,
  rooms,
  roomSettings,
  users,
} from "@/server/db/schema";
import { roomDefinitions, roomSessions } from "@/server/db/schema/room-control";

/**
 * Account deletion (LGPD): the account stops being tied to any room. A room it owned goes
 * to its oldest moderator; with no moderator left, the room and everything saved under it
 * are deleted (archived, when the host controls already keep calls of it). Runs inside the
 * deletion's transaction.
 */
export async function forgetRoomLinks(tx: DbExecutor, userId: string) {
  const owned = await tx
    .select({ roomCode: roomRoles.roomCode })
    .from(roomRoles)
    .where(and(eq(roomRoles.userId, userId), eq(roomRoles.role, "owner")))
    .orderBy(asc(roomRoles.roomCode))
    .for("update");
  for (const { roomCode } of owned) {
    await handOverOrDeleteRoom(tx, roomCode, userId);
  }
  await tx.delete(roomRoles).where(eq(roomRoles.userId, userId));
  await tx
    .update(roomRoles)
    .set({ grantedByUserId: null })
    .where(eq(roomRoles.grantedByUserId, userId));
  await tx
    .update(roomSettings)
    .set({ updatedByUserId: null })
    .where(eq(roomSettings.updatedByUserId, userId));
  await tx.update(rooms).set({ createdByUserId: null }).where(eq(rooms.createdByUserId, userId));
}

async function handOverOrDeleteRoom(tx: DbExecutor, roomCode: string, ownerUserId: string) {
  const heir = await oldestModerator(tx, roomCode);
  if (!heir) {
    await deleteRoom(tx, roomCode);
    return;
  }
  // The owner row goes first: a room has a single owner (room_roles_owner_key).
  await tx
    .delete(roomRoles)
    .where(and(eq(roomRoles.roomCode, roomCode), eq(roomRoles.userId, ownerUserId)));
  await tx
    .update(roomRoles)
    .set({ role: "owner", grantedByUserId: null })
    .where(and(eq(roomRoles.roomCode, roomCode), eq(roomRoles.userId, heir)));
  await tx
    .update(roomDefinitions)
    .set({ ownerUserId: heir })
    .where(eq(roomDefinitions.code, roomCode));
}

/** The moderator with the oldest role among active accounts; ties go by account id. */
async function oldestModerator(tx: DbExecutor, roomCode: string): Promise<string | undefined> {
  const [moderator] = await tx
    .select({ userId: roomRoles.userId })
    .from(roomRoles)
    .innerJoin(users, eq(users.id, roomRoles.userId))
    .where(
      and(
        eq(roomRoles.roomCode, roomCode),
        eq(roomRoles.role, "moderator"),
        isNull(users.deletedAt),
      ),
    )
    .orderBy(asc(roomRoles.createdAt), asc(roomRoles.userId))
    .limit(1);
  return moderator?.userId;
}

/**
 * Roles, settings and join requests go with the room (on delete cascade); bans have no key.
 * A room whose calls the host controls recorded stays as history, archived: its token is
 * refused from then on.
 */
async function deleteRoom(tx: DbExecutor, roomCode: string) {
  await tx.delete(roomBans).where(eq(roomBans.roomCode, roomCode));
  const deleted = await tx
    .delete(roomDefinitions)
    .where(
      and(
        eq(roomDefinitions.code, roomCode),
        sql`not exists (select 1 from ${roomSessions} where ${roomSessions.definitionId} = ${roomDefinitions.id})`,
      ),
    )
    .returning({ code: roomDefinitions.code });
  if (deleted.length > 0) return;
  await tx.delete(roomRoles).where(eq(roomRoles.roomCode, roomCode));
  await tx.delete(roomSettings).where(eq(roomSettings.roomCode, roomCode));
  await tx.delete(roomJoinRequests).where(eq(roomJoinRequests.roomCode, roomCode));
  await tx
    .update(roomDefinitions)
    .set({ ownerUserId: null, archivedAt: sql`coalesce(${roomDefinitions.archivedAt}, now())` })
    .where(eq(roomDefinitions.code, roomCode));
}
