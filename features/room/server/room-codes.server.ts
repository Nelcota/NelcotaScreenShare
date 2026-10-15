import { eq } from "drizzle-orm";
import { generateRoomCode } from "@/features/room/domain/room-code";
import type { Database, DbExecutor } from "@/server/db/index.server";
import { roomRoles } from "@/server/db/schema";
import { roomDefinitions } from "@/server/db/schema/room-control";

/** Codes drawn before giving up; a clash is already rare with the first one. */
const CODE_ATTEMPTS = 5;

/**
 * A room exists once someone created it, through "Criar sala" or as a permanent or team
 * room (all in `room_definitions`); any other valid code is refused.
 */
export async function roomExists(db: DbExecutor, code: string): Promise<boolean> {
  const [definition] = await db
    .select({ code: roomDefinitions.code })
    .from(roomDefinitions)
    .where(eq(roomDefinitions.code, code))
    .limit(1);
  return definition !== undefined;
}

/** Creates a room with a new code, owned by the account that created it. */
export async function createRoom(db: Database, ownerUserId: string): Promise<string> {
  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
    const code = await tryCreateRoom(db, generateRoomCode(), ownerUserId);
    if (code) return code;
  }
  throw new Error("no free room code");
}

async function tryCreateRoom(
  db: Database,
  code: string,
  ownerUserId: string,
): Promise<string | undefined> {
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(roomDefinitions)
      .values({ code, ownerUserId, kind: "ad_hoc" })
      .onConflictDoNothing()
      .returning({ code: roomDefinitions.code });
    if (!created) return undefined;
    await tx.insert(roomRoles).values({ roomCode: code, userId: ownerUserId, role: "owner" });
    return created.code;
  });
}
