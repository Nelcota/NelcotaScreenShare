import { and, eq, ne } from "drizzle-orm";
import type { Database } from "@/server/db/index.server";
import { roomSessions } from "@/server/db/schema/room-control";
import { logger } from "@/server/logger.server";
import { controlGateway } from "./control-gateway.server";
import { lockControlRoom, sessionByMediaName } from "./session-store.server";
import { reconcileSessionPresence } from "./session-presence.server";
import { retryRoomCommands } from "./control-commands.server";

type RoomSession = typeof roomSessions.$inferSelect;

/** A session whose definition is gone has no room to belong to: it just ends. */
async function closeOrphanSession(db: Database, sessionId: string, now: Date) {
  await db
    .update(roomSessions)
    .set({ status: "closed", closedAt: now })
    .where(and(eq(roomSessions.id, sessionId), ne(roomSessions.status, "closed")));
}

async function maintainSession(db: Database, initial: RoomSession, now: Date) {
  const definition = await sessionByMediaName(db, initial.mediaRoomName);
  if (!definition) {
    await closeOrphanSession(db, initial.id, now);
    return;
  }
  await db.transaction(async (tx) => {
    await lockControlRoom(tx, definition.code);
    const [session] = await tx.select().from(roomSessions).where(eq(roomSessions.id, initial.id));
    if (!session || session.status === "closed") return;
    await reconcileSessionPresence(
      tx,
      session,
      await controlGateway.participants(session.mediaRoomName),
      now,
    );
  });
}

/** One room failing (LiveKit down for it, a bad row) does not hold up the others. */
export async function maintainRoomControls(db: Database, now = new Date()) {
  const sessions = await db.select().from(roomSessions).where(ne(roomSessions.status, "closed"));
  for (const initial of sessions) {
    try {
      await maintainSession(db, initial, now);
    } catch (error) {
      logger.warn(
        { err: error, sessionId: initial.id },
        "room control maintenance failed for a session",
      );
    }
  }
  await retryRoomCommands(db, now);
}

export function scheduleRoomControls(getDatabase: () => Database) {
  let pending: Promise<void> | undefined;
  const timer = setInterval(() => {
    pending ??= maintainRoomControls(getDatabase())
      .catch(() => logger.warn("room control maintenance failed; retrying"))
      .finally(() => {
        pending = undefined;
      });
  }, 5_000);
  timer.unref();
  return async () => {
    clearInterval(timer);
    await pending;
  };
}
