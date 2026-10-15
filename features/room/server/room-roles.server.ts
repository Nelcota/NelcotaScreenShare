import { and, eq } from "drizzle-orm";
import type { RoomRole } from "@/features/room/domain/room-role";
import type { DbExecutor } from "@/server/db/index.server";
import { roomRoles } from "@/server/db/schema";

/** The account's saved role in the room; without a row, a participant. */
export async function roomRoleOf(
  db: DbExecutor,
  { roomCode, userId }: { roomCode: string; userId: string },
): Promise<RoomRole> {
  const [saved] = await db
    .select({ role: roomRoles.role })
    .from(roomRoles)
    .where(and(eq(roomRoles.roomCode, roomCode), eq(roomRoles.userId, userId)));
  return saved?.role ?? "participant";
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
  return new Map(rows.map((row) => [row.userId, row.role]));
}
