import { eq } from "drizzle-orm";
import { managesRoomAccess, type RoomAccess } from "@/features/room/domain/room-access";
import { roomRoleOf } from "@/features/room/server/room-roles.server";
import type { DbExecutor } from "@/server/db/index.server";
import { roomSettings } from "@/server/db/schema";

/** How people get into the room; without a saved choice, open. */
export async function roomAccessOf(db: DbExecutor, roomCode: string): Promise<RoomAccess> {
  const [row] = await db
    .select({ access: roomSettings.access })
    .from(roomSettings)
    .where(eq(roomSettings.roomCode, roomCode));
  return row?.access ?? "open";
}

export async function saveRoomAccess(
  db: DbExecutor,
  { roomCode, access, userId }: { roomCode: string; access: RoomAccess; userId: string },
) {
  await db
    .insert(roomSettings)
    .values({ roomCode, access, updatedByUserId: userId })
    .onConflictDoUpdate({
      target: roomSettings.roomCode,
      set: { access, updatedByUserId: userId },
    });
}

/**
 * Whether the account still has to be let in: the room asks for approval and they are not
 * the owner or a moderator. Until then, who is inside stays hidden from them.
 */
export async function awaitsApproval(
  db: DbExecutor,
  roomCode: string,
  userId: string,
): Promise<boolean> {
  if ((await roomAccessOf(db, roomCode)) !== "approval") return false;
  return !managesRoomAccess(await roomRoleOf(db, { roomCode, userId }));
}
