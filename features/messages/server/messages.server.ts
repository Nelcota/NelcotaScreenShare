import { and, desc, eq, lt, sql } from "drizzle-orm";
import { MESSAGE_PAGE_SIZE } from "@/features/messages/domain/conversation";
import type { DbExecutor } from "@/server/db/index.server";
import { conversations, messages, userBlocks, users } from "@/server/db/schema";

/** A text, a GIF, or the optional text over an attachment (linked after the insert). */
export type MessageContent =
  | { body: string; gifSlug: null }
  | { body: null; gifSlug: string }
  | { body: string | null; gifSlug: null };

export interface StoredMessage {
  id: string;
  authorId: string;
  authorName: string;
  body: string | null;
  gifSlug: string | null;
  createdAt: Date;
}

export interface MessagePage {
  messages: StoredMessage[];
  hasMore: boolean;
}

export async function insertMessage(
  db: DbExecutor,
  conversationId: string,
  authorId: string,
  content: MessageContent,
): Promise<{ id: string; createdAt: Date }> {
  const [message] = await db
    .insert(messages)
    .values({ conversationId, authorId, ...content })
    .returning({ id: messages.id, createdAt: messages.createdAt });
  if (!message) throw new Error("Message insert returned no row.");
  await db
    .update(conversations)
    .set({ lastMessageAt: message.createdAt })
    .where(eq(conversations.id, conversationId));
  return message;
}

/**
 * Messages this person may see: in a group, nothing from someone they blocked, even if the
 * group is older than the block.
 */
export function visibleTo(viewerId: string) {
  return sql`not exists (
    select 1 from ${userBlocks}
    where ${userBlocks.blockerId} = ${viewerId}::uuid and ${userBlocks.blockedId} = ${messages.authorId}
  )`;
}

/** The newest page, or the page before a given message; oldest first, as the screen shows them. */
export async function listMessages(
  db: DbExecutor,
  conversationId: string,
  beforeId: string | null,
  viewerId: string,
): Promise<MessagePage> {
  const rows = await db
    .select({
      id: messages.id,
      authorId: messages.authorId,
      authorName: users.name,
      body: messages.body,
      gifSlug: messages.gifSlug,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .innerJoin(users, eq(users.id, messages.authorId))
    .where(
      and(
        eq(messages.conversationId, conversationId),
        beforeId ? lt(messages.id, beforeId) : undefined,
        visibleTo(viewerId),
      ),
    )
    .orderBy(desc(messages.id))
    .limit(MESSAGE_PAGE_SIZE + 1);
  const hasMore = rows.length > MESSAGE_PAGE_SIZE;
  return { messages: rows.slice(0, MESSAGE_PAGE_SIZE).toReversed(), hasMore };
}

/** Deletes a message only its author can delete; returns its conversation, or null. */
export async function deleteOwnMessage(
  db: DbExecutor,
  messageId: string,
  authorId: string,
): Promise<string | null> {
  const [deleted] = await db
    .delete(messages)
    .where(and(eq(messages.id, messageId), eq(messages.authorId, authorId)))
    .returning({ conversationId: messages.conversationId });
  if (!deleted) return null;
  await refreshLastMessageAt(db, deleted.conversationId);
  return deleted.conversationId;
}

/** Keeps the conversation list in order after messages are deleted. */
export async function refreshLastMessageAt(db: DbExecutor, conversationId: string) {
  await db
    .update(conversations)
    .set({
      lastMessageAt: sql`(select max(${messages.createdAt}) from ${messages} where ${messages.conversationId} = ${conversationId})`,
    })
    .where(eq(conversations.id, conversationId));
}
