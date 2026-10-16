import { and, eq } from "drizzle-orm";
import type { RoomRole } from "@/features/room/domain/room-role";
import type { DbExecutor } from "@/server/db/index.server";
import { roomRoles } from "@/server/db/schema";
import { roomDefinitions } from "@/server/db/schema/room-control";

/**
 * A personal room is owned through its definition (`owner_user_id`), with no row in
 * room_roles: that account is its owner all the same (ADR 0007), first to host and to
 * take the host back.
 */
async function personalOwnerOf(db: DbExecutor, roomCode: string): Promise<string | undefined> {
  const [definition] = await db
    .select({ ownerUserId: roomDefinitions.ownerUserId })
    .from(roomDefinitions)
    .where(and(eq(roomDefinitions.code, roomCode), eq(roomDefinitions.kind, "personal")));
  return definition?.ownerUserId ?? undefined;
}

/** The account's saved role in the room; without a row, a participant. */
export async function roomRoleOf(
  db: DbExecutor,
  { roomCode, userId }: { roomCode: string; userId: string },
): Promise<RoomRole> {
  const [saved] = await db
    .select({ role: roomRoles.role })
    .from(roomRoles)
    .where(and(eq(roomRoles.roomCode, roomCode), eq(roomRoles.userId, userId)));
  if (saved) return saved.role;
  if ((await personalOwnerOf(db, roomCode)) === userId) return "owner";
  return "participant";
}

/** Owner and moderators of the room by account; anyone missing is a participant. */
export async function savedRolesIn(
  db: DbExecutor,
  roomCode: string,
): Promise<ReadonlyMap<string, RoomRole>> {
  const rows = await db
    .select({ userId: roomRoles.userId, role: roomRoles.role })
    .from(roomRoles)
    .where(eq(roomRoles.roomCode, roomCode));
  const roles = new Map<string, RoomRole>(rows.map((row) => [row.userId, row.role]));
  const personalOwner = await personalOwnerOf(db, roomCode);
  if (personalOwner) roles.set(personalOwner, "owner");
  return roles;
}
