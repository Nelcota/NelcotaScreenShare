import { and, asc, count, desc, eq, gt, inArray, ne, sql } from "drizzle-orm";
import type { DbExecutor } from "@/server/db/index.server";
import { conversationMembers, conversations, messages, users } from "@/server/db/schema";
import { visibleTo, type StoredMessage } from "./messages.server";

/** Conversations shown in the column; older ones beyond this wait for a later page. */
const LIST_LIMIT = 100;

interface ConversationPerson {
  id: string;
  name: string;
}

export interface ConversationSummary {
  id: string;
  kind: "direct" | "group";
  name: string | null;
  /** Everyone else in the conversation. */
  others: ConversationPerson[];
  lastMessage: StoredMessage | null;
  unread: number;
}

type MembershipRow = Awaited<ReturnType<typeof membershipRows>>[number];

function membershipRows(db: DbExecutor, userId: string) {
  return db
    .select({
      id: conversations.id,
      kind: conversations.kind,
      name: conversations.name,
    })
    .from(conversationMembers)
    .innerJoin(conversations, eq(conversations.id, conversationMembers.conversationId))
    .where(eq(conversationMembers.userId, userId))
    .orderBy(desc(sql`coalesce(${conversations.lastMessageAt}, ${conversations.createdAt})`))
    .limit(LIST_LIMIT);
}

export async function othersByConversation(db: DbExecutor, userId: string, ids: string[]) {
  const rows = await db
    .select({
      conversationId: conversationMembers.conversationId,
      id: users.id,
      name: users.name,
    })
    .from(conversationMembers)
    .innerJoin(users, eq(users.id, conversationMembers.userId))
    .where(and(inArray(conversationMembers.conversationId, ids), ne(users.id, userId)))
    .orderBy(asc(users.name));
  const grouped = new Map<string, ConversationPerson[]>();
  for (const row of rows) {
    const people = grouped.get(row.conversationId) ?? [];
    people.push({ id: row.id, name: row.name });
    grouped.set(row.conversationId, people);
  }
  return grouped;
}

async function lastMessages(db: DbExecutor, userId: string, ids: string[]) {
  const rows = await db
    .selectDistinctOn([messages.conversationId], {
      conversationId: messages.conversationId,
      id: messages.id,
      authorId: messages.authorId,
      authorName: users.name,
      body: messages.body,
      gifSlug: messages.gifSlug,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .innerJoin(users, eq(users.id, messages.authorId))
    .where(and(inArray(messages.conversationId, ids), visibleTo(userId)))
    .orderBy(messages.conversationId, desc(messages.id));
  return new Map(rows.map(({ conversationId, ...message }) => [conversationId, message]));
}

/** Messages from others after the last time the user read the conversation. */
async function unreadCounts(db: DbExecutor, userId: string, ids: string[]) {
  const rows = await db
    .select({ conversationId: messages.conversationId, total: count() })
    .from(messages)
    .innerJoin(
      conversationMembers,
      and(
        eq(conversationMembers.conversationId, messages.conversationId),
        eq(conversationMembers.userId, userId),
      ),
    )
    .where(
      and(
        inArray(messages.conversationId, ids),
        ne(messages.authorId, userId),
        visibleTo(userId),
        gt(
          messages.createdAt,
          sql`coalesce(${conversationMembers.lastReadAt}, ${conversationMembers.joinedAt})`,
        ),
      ),
    )
    .groupBy(messages.conversationId);
  return new Map(rows.map((row) => [row.conversationId, row.total]));
}

function summarize(
  row: MembershipRow,
  others: Map<string, ConversationPerson[]>,
  latest: Map<string, StoredMessage>,
  unread: Map<string, number>,
): ConversationSummary {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    others: others.get(row.id) ?? [],
    lastMessage: latest.get(row.id) ?? null,
    unread: unread.get(row.id) ?? 0,
  };
}

/** The column's list: most recent activity first. */
export async function conversationList(
  db: DbExecutor,
  userId: string,
): Promise<ConversationSummary[]> {
  const rows = await membershipRows(db, userId);
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const others = await othersByConversation(db, userId, ids);
  const latest = await lastMessages(db, userId, ids);
  const unread = await unreadCounts(db, userId, ids);
  return rows.map((row) => summarize(row, others, latest, unread));
}

export interface UnreadSummary {
  total: number;
  /** The newest unread message, for the notification. */
  latest: {
    id: string;
    conversationId: string;
    authorName: string;
    body: string | null;
    gifSlug: string | null;
  } | null;
}

function unreadCondition(userId: string) {
  return and(
    ne(messages.authorId, userId),
    visibleTo(userId),
    gt(
      messages.createdAt,
      sql`coalesce(${conversationMembers.lastReadAt}, ${conversationMembers.joinedAt})`,
    ),
  );
}

/** Unread messages across every conversation: the tab's count and the newest one. */
export async function unreadSummary(db: DbExecutor, userId: string): Promise<UnreadSummary> {
  const membership = and(
    eq(conversationMembers.conversationId, messages.conversationId),
    eq(conversationMembers.userId, userId),
  );
  const [counted] = await db
    .select({ total: count() })
    .from(messages)
    .innerJoin(conversationMembers, membership)
    .where(unreadCondition(userId));
  const [latest] = await db
    .select({
      id: messages.id,
      conversationId: messages.conversationId,
      authorName: users.name,
      body: messages.body,
      gifSlug: messages.gifSlug,
    })
    .from(messages)
    .innerJoin(conversationMembers, membership)
    .innerJoin(users, eq(users.id, messages.authorId))
    .where(unreadCondition(userId))
    .orderBy(desc(messages.id))
    .limit(1);
  return { total: counted?.total ?? 0, latest: latest ?? null };
}

/** A group in the friends column: name, members and unread count. */
export type ColumnGroup = Pick<ConversationSummary, "id" | "kind" | "name" | "others" | "unread">;

/**
 * What the friends column shows of the conversations: unread counts on each friend's photo
 * (their direct conversation) and the groups, most recent first.
 */
export async function columnConversations(db: DbExecutor, userId: string) {
  const list = await conversationList(db, userId);
  const unreadByFriend: Record<string, number> = {};
  for (const conversation of list) {
    const [other] = conversation.others;
    if (conversation.kind !== "direct" || !other || conversation.unread === 0) continue;
    unreadByFriend[other.id] = conversation.unread;
  }
  const groups: ColumnGroup[] = list
    .filter((conversation) => conversation.kind === "group")
    .map(({ id, kind, name, others, unread }) => ({ id, kind, name, others, unread }));
  return { unreadByFriend, groups };
}
