import { annotationEpochs } from "@/server/db/schema/annotations";
import { and, eq, inArray, lt } from "drizzle-orm";
import type { Database } from "@/server/db/index.server";
import { roomCommands, roomSessionMembers, roomSessions } from "@/server/db/schema/room-control";

/** Admission/exclusion identities are needed only during a call and its security retention. */
export async function purgeRoomControlHistory(db: Database, now: Date) {
  const before = new Date(now.getTime() - 183 * 86_400_000);
  const old = db
    .select({ id: roomSessions.id })
    .from(roomSessions)
    .where(and(eq(roomSessions.status, "closed"), lt(roomSessions.closedAt, before)));
  await db.delete(annotationEpochs).where(inArray(annotationEpochs.sessionId, old));
  await db.delete(roomCommands).where(inArray(roomCommands.sessionId, old));
  await db.delete(roomSessionMembers).where(inArray(roomSessionMembers.sessionId, old));
  await db
    .update(roomSessions)
    .set({ hostUserId: null, allowedSharers: [] })
    .where(and(eq(roomSessions.status, "closed"), lt(roomSessions.closedAt, before)));
}
