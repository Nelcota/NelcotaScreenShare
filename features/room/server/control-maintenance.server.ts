import { eq, ne } from "drizzle-orm";
import type { Database } from "@/server/db/index.server";
import { roomSessions } from "@/server/db/schema/room-control";
import { logger } from "@/server/logger.server";
import { controlGateway } from "./control-gateway.server";
import { lockControlRoom, sessionByMediaName } from "./session-store.server";
import { reconcileSessionPresence } from "./session-presence.server";
import { retryRoomCommands } from "./control-commands.server";

export async function maintainRoomControls(db: Database, now = new Date()) {
  const sessions = await db.select().from(roomSessions).where(ne(roomSessions.status, "closed"));
  for (const initial of sessions) {
    const definition = await sessionByMediaName(db, initial.mediaRoomName);
    if (!definition) continue;
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
