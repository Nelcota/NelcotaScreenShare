import { and, asc, eq, lte, ne } from "drizzle-orm";
import type { Database } from "@/server/db/index.server";
import { roomCommands, roomSessionMembers, roomSessions } from "@/server/db/schema/room-control";
import { logger } from "@/server/logger.server";
import { controlGateway } from "./control-gateway.server";
import { savedRolesIn } from "./room-roles.server";
import { lockControlRoom, sessionByMediaName } from "./session-store.server";
import { closeSignalConnections } from "./signal-relay.server";

/** State has already committed; this separate transaction records transport outcomes. */
export async function applyRoomCommand(db: Database, id: string) {
  const [initial] = await db.select().from(roomCommands).where(eq(roomCommands.id, id));
  if (!initial) throw new Error("Room command not found");
  const [initialSession] = await db
    .select()
    .from(roomSessions)
    .where(eq(roomSessions.id, initial.sessionId));
  if (!initialSession) throw new Error("Room session not found");
  const resolved = await sessionByMediaName(db, initialSession.mediaRoomName);
  if (!resolved) throw new Error("Room definition not found");
  return db.transaction(async (tx) => {
    await lockControlRoom(tx, resolved.code);
    const [command] = await tx.select().from(roomCommands).where(eq(roomCommands.id, id));
    const [session] = await tx
      .select()
      .from(roomSessions)
      .where(eq(roomSessions.id, initial.sessionId));
    if (!command || !session) throw new Error("Room command disappeared");
    if (command.status === "applied") return "applied" as const;
    try {
      if (session.status === "closed") {
        await controlGateway.close(session.mediaRoomName);
        closeSignalConnections(session.mediaRoomName);
      }
      if (session.status !== "closed" && command.kind === "remove" && command.targetIdentity) {
        const [member] = await tx
          .select()
          .from(roomSessionMembers)
          .where(
            and(
              eq(roomSessionMembers.sessionId, session.id),
              eq(roomSessionMembers.identity, command.targetIdentity),
            ),
          );
        if (member?.excludedAt) {
          await controlGateway.remove(session.mediaRoomName, command.targetIdentity);
          closeSignalConnections(session.mediaRoomName, command.targetIdentity);
        }
      }
      if (session.status !== "closed" && command.kind === "sync")
        await controlGateway.sync(session, await savedRolesIn(tx, resolved.code));
      await tx
        .update(roomCommands)
        .set({ status: "applied", attempts: command.attempts + 1, error: null })
        .where(eq(roomCommands.id, id));
      return "applied" as const;
    } catch {
      await tx
        .update(roomCommands)
        .set({
          status: "failed",
          attempts: command.attempts + 1,
          error: "LiveKit transport operation failed",
          nextAttemptAt: new Date(Date.now() + Math.min(60_000, 5_000 * (command.attempts + 1))),
        })
        .where(eq(roomCommands.id, id));
      return "failed" as const;
    }
  });
}

export async function retryRoomCommands(db: Database, now = new Date()) {
  const commands = await db
    .select({ id: roomCommands.id })
    .from(roomCommands)
    .where(and(ne(roomCommands.status, "applied"), lte(roomCommands.nextAttemptAt, now)))
    .orderBy(asc(roomCommands.createdAt))
    .limit(50);
  // One command that breaks (a lock timeout, a row gone mid-way) waits for the next round;
  // it does not hold up the other rooms' commands behind it.
  for (const command of commands) {
    try {
      await applyRoomCommand(db, command.id);
    } catch (error) {
      logger.warn({ err: error, commandId: command.id }, "room command retry failed");
    }
  }
  return commands.length;
}
