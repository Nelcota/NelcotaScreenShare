import { and, desc, eq, sql } from "drizzle-orm";
import { notifyUsers } from "@/features/live/server/live-bus.server";
import { canMessage, openDirect } from "@/features/messages/server/conversations.server";
import { insertMessage } from "@/features/messages/server/messages.server";
import type { Database, DbExecutor } from "@/server/db/index.server";
import { conversations, messages } from "@/server/db/schema";

/** The conversation's last message when it is this caller's missed call, read or not. */
async function trailingMissedCall(db: DbExecutor, conversationId: string, callerId: string) {
  const [latest] = await db
    .select({ id: messages.id, kind: messages.kind, authorId: messages.authorId })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt), desc(messages.id))
    .limit(1);
  if (latest === undefined) return null;
  if (latest.kind !== "missed_call" || latest.authorId !== callerId) return null;
  return latest.id;
}

/** Moves a missed call to now, so it shows the latest call and counts as unread again. */
async function bumpMissedCall(db: DbExecutor, conversationId: string, messageId: string) {
  await db
    .update(messages)
    .set({ createdAt: sql`now()` })
    .where(and(eq(messages.id, messageId), eq(messages.conversationId, conversationId)));
  await db
    .update(conversations)
    .set({ lastMessageAt: sql`now()` })
    .where(eq(conversations.id, conversationId));
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
    // Calling again never piles up lines, and the caller sees the same whether the friend read
    // the last one or not: deciding by their read state would give away activity in Invisível.
    const previous = await trailingMissedCall(tx, conversationId, callerId);
    if (previous !== null) {
      await bumpMissedCall(tx, conversationId, previous);
      return true;
    }
    await insertMessage(tx, conversationId, callerId, {
      kind: "missed_call",
      body: null,
      gifSlug: null,
    });
    return true;
  });
  if (left) notifyUsers([callerId, calleeId], "messages");
}
