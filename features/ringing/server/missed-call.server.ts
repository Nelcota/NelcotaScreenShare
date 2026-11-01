import { and, desc, eq, sql } from "drizzle-orm";
import { notifyUsers } from "@/features/live/server/live-bus.server";
import { canMessage, openDirect } from "@/features/messages/server/conversations.server";
import { insertMessage } from "@/features/messages/server/messages.server";
import type { Database, DbExecutor } from "@/server/db/index.server";
import { conversationMembers, messages } from "@/server/db/schema";

/** Whether the conversation already ends in this caller's missed call that the callee has not read. */
async function hasUnreadMissedCall(
  db: DbExecutor,
  conversationId: string,
  callerId: string,
  calleeId: string,
) {
  const [latest] = await db
    .select({
      kind: messages.kind,
      authorId: messages.authorId,
      unread: sql<boolean>`${messages.createdAt} > coalesce(${conversationMembers.lastReadAt}, ${conversationMembers.joinedAt})`,
    })
    .from(messages)
    .innerJoin(
      conversationMembers,
      and(
        eq(conversationMembers.conversationId, messages.conversationId),
        eq(conversationMembers.userId, calleeId),
      ),
    )
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt), desc(messages.id))
    .limit(1);
  if (latest === undefined) return false;
  return latest.kind === "missed_call" && latest.authorId === callerId && latest.unread;
}

/**
 * Leaves a call to a friend who looks Offline as "Chamada perdida" in the pair's conversation,
 * which counts as unread until they open it. The caller sees it there too.
 *
 * @param db - The database; the conversation is opened before the message's transaction.
 * @param callerId - Who called, the message's author.
 * @param calleeId - The friend who was Offline.
 */
export async function leaveMissedCall(db: Database, callerId: string, calleeId: string) {
  // Opened before, not in the same transaction: a first conversation would join both people
  // at the call's own instant, and the call would never count as unread.
  const conversationId = await openDirect(db, callerId, calleeId);
  const left = await db.transaction(async (tx) => {
    // Checked again with the insert, as sending a message does: a block or an unfriend since
    // the call was checked leaves nothing.
    if (!(await canMessage(tx, callerId, calleeId))) return false;
    // One line until they open it: calling again meanwhile does not pile up missed calls.
    if (await hasUnreadMissedCall(tx, conversationId, callerId, calleeId)) return false;
    await insertMessage(tx, conversationId, callerId, {
      kind: "missed_call",
      body: null,
      gifSlug: null,
    });
    return true;
  });
  if (left) notifyUsers([callerId, calleeId], "messages");
}
