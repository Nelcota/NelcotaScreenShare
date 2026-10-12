import { and, eq, isNull, sql } from "drizzle-orm";
import type { DbExecutor } from "@/server/db/index.server";
import {
  roomCommands,
  roomDefinitions,
  roomSessionMembers,
  roomSessions,
} from "@/server/db/schema/room-control";
import { lockControlRoom } from "@/features/room/server/session-store.server";

/** Membership loss and admission exclusions commit together; transport effects retry. */
export async function revokeTeamSessions(tx: DbExecutor, teamId: string, identity?: string) {
  const sessions = await tx
    .select({ session: roomSessions, code: roomDefinitions.code })
    .from(roomSessions)
    .innerJoin(roomDefinitions, eq(roomDefinitions.id, roomSessions.definitionId))
    .where(and(eq(roomDefinitions.teamId, teamId), isNull(roomSessions.closedAt)))
    .orderBy(roomDefinitions.code);
  const commands: string[] = [];
  for (const { session: candidate, code } of sessions) {
    await lockControlRoom(tx, code);
    const [session] = await tx.select().from(roomSessions).where(eq(roomSessions.id, candidate.id));
    if (!session || session.closedAt) continue;
    if (!identity) {
      await tx
        .update(roomSessions)
        .set({ status: "closed", closedAt: new Date(), admissionLocked: true })
        .where(eq(roomSessions.id, session.id));
      const [command] = await tx
        .insert(roomCommands)
        .values({ sessionId: session.id, kind: "close" })
        .returning({ id: roomCommands.id });
      if (command) commands.push(command.id);
      continue;
    }
    const affected = await tx
      .update(roomSessionMembers)
      .set({ excludedAt: new Date() })
      .where(
        and(
          eq(roomSessionMembers.sessionId, session.id),
          eq(roomSessionMembers.identity, identity),
          isNull(roomSessionMembers.excludedAt),
        ),
      )
      .returning();
    if (session.hostUserId === identity)
      await tx
        .update(roomSessions)
        .set({ hostUserId: null, hostMissingAt: new Date(Date.now() - 60_001) })
        .where(eq(roomSessions.id, session.id));
    if (affected.length === 0) continue;
    const [command] = await tx
      .insert(roomCommands)
      .values({ sessionId: session.id, kind: "remove", targetIdentity: identity })
      .returning({ id: roomCommands.id });
    if (command) commands.push(command.id);
  }
  return commands;
}
export async function archiveTeamRooms(tx: DbExecutor, teamId: string) {
  await tx
    .update(roomDefinitions)
    .set({ archivedAt: sql`coalesce(${roomDefinitions.archivedAt}, now())` })
    .where(eq(roomDefinitions.teamId, teamId));
  return revokeTeamSessions(tx, teamId);
}
