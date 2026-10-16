import { and, eq, inArray, sql } from "drizzle-orm";
import { friendPair } from "@/features/friends/domain/friendship";
import { isActiveAccount, isBlockedEitherWay } from "@/features/friends/server/friendships.server";
import type { DbExecutor } from "@/server/db/index.server";
import { conversationMembers, conversations, friendships } from "@/server/db/schema";

export interface Membership {
  kind: "direct" | "group";
  /** The other person in a direct conversation; null in a group. */
  otherId: string | null;
}

/** Friends with an accepted friendship, both accounts active, and no block either way. */
export async function canMessage(db: DbExecutor, one: string, other: string): Promise<boolean> {
  const pair = friendPair(one, other);
  const [friendship] = await db
    .select({ status: friendships.status })
    .from(friendships)
    .where(
      and(
        eq(friendships.userLowId, pair.userLowId),
        eq(friendships.userHighId, pair.userHighId),
        eq(friendships.status, "accepted"),
      ),
    );
  if (!friendship) return false;
  if (!(await isActiveAccount(db, one)) || !(await isActiveAccount(db, other))) return false;
  return !(await isBlockedEitherWay(db, one, other));
}

/** Of the given accounts, those the user can message. */
export async function messageableFriends(
  db: DbExecutor,
  userId: string,
  candidateIds: readonly string[],
): Promise<Set<string>> {
  const allowed = new Set<string>();
  for (const candidateId of candidateIds) {
    if (await canMessage(db, userId, candidateId)) allowed.add(candidateId);
  }
  return allowed;
}

/** The pair's direct conversation, created the first time; safe when both open it at once. */
export async function openDirect(db: DbExecutor, one: string, other: string): Promise<string> {
  const pair = friendPair(one, other);
  const pairCondition = and(
    eq(conversations.kind, "direct"),
    eq(conversations.directLowId, pair.userLowId),
    eq(conversations.directHighId, pair.userHighId),
  );
  await db
    .insert(conversations)
    .values({
      kind: "direct",
      directLowId: pair.userLowId,
      directHighId: pair.userHighId,
      createdBy: one,
    })
    .onConflictDoNothing({
      target: [conversations.directLowId, conversations.directHighId],
      where: sql`${conversations.kind} = 'direct'`,
    });
  const [conversation] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(pairCondition);
  if (!conversation) throw new Error("Direct conversation missing after insert.");
  await db
    .insert(conversationMembers)
    .values([
      { conversationId: conversation.id, userId: one },
      { conversationId: conversation.id, userId: other },
    ])
    .onConflictDoNothing();
  return conversation.id;
}

export async function createGroup(
  db: DbExecutor,
  creatorId: string,
  inviteeIds: readonly string[],
  name: string | null,
): Promise<string> {
  const [conversation] = await db
    .insert(conversations)
    .values({ kind: "group", name, createdBy: creatorId })
    .returning({ id: conversations.id });
  if (!conversation) throw new Error("Group insert returned no row.");
  const memberIds = [creatorId, ...inviteeIds];
  await db
    .insert(conversationMembers)
    .values(memberIds.map((userId) => ({ conversationId: conversation.id, userId })));
  return conversation.id;
}

/** The user's place in the conversation, or null when they are not a member. */
export async function membershipOf(
  db: DbExecutor,
  conversationId: string,
  userId: string,
): Promise<Membership | null> {
  const [row] = await db
    .select({
      kind: conversations.kind,
      directLowId: conversations.directLowId,
      directHighId: conversations.directHighId,
    })
    .from(conversationMembers)
    .innerJoin(conversations, eq(conversations.id, conversationMembers.conversationId))
    .where(
      and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, userId),
      ),
    );
  if (!row) return null;
  if (row.kind === "group") return { kind: "group", otherId: null };
  const otherId = row.directLowId === userId ? row.directHighId : row.directLowId;
  return { kind: "direct", otherId };
}

/** Everyone in the conversation, for nudging their open tabs. */
export async function memberIdsOf(db: DbExecutor, conversationId: string): Promise<string[]> {
  const rows = await db
    .select({ userId: conversationMembers.userId })
    .from(conversationMembers)
    .where(eq(conversationMembers.conversationId, conversationId));
  return rows.map((row) => row.userId);
}

export async function markRead(db: DbExecutor, conversationId: string, userId: string) {
  await db
    .update(conversationMembers)
    .set({ lastReadAt: sql`now()` })
    .where(
      and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, userId),
      ),
    );
}

/** Leaves a group; the last one out takes the group and its messages with them. */
export async function leaveGroup(db: DbExecutor, conversationId: string, userId: string) {
  await db
    .delete(conversationMembers)
    .where(
      and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, userId),
      ),
    );
  await deleteEmptyGroups(db, [conversationId]);
}

export async function deleteEmptyGroups(db: DbExecutor, conversationIds: readonly string[]) {
  if (conversationIds.length === 0) return;
  await db
    .delete(conversations)
    .where(
      and(
        inArray(conversations.id, [...conversationIds]),
        eq(conversations.kind, "group"),
        sql`not exists (select 1 from ${conversationMembers} where ${conversationMembers.conversationId} = ${conversations.id})`,
      ),
    );
}
