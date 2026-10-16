import { and, count, eq, isNull, or, sql } from "drizzle-orm";
import {
  friendPair,
  type BlockState,
  type ExistingFriendship,
} from "@/features/friends/domain/friendship";
import { retireFriendCode } from "@/features/friends/server/friend-code-retirement.server";
import type { DbExecutor } from "@/server/db/index.server";
import { friendLinks, friendships, userBlocks, userPresence, users } from "@/server/db/schema";

function pairCondition(one: string, other: string) {
  const pair = friendPair(one, other);
  return and(
    eq(friendships.userLowId, pair.userLowId),
    eq(friendships.userHighId, pair.userHighId),
  );
}

function involves(userId: string) {
  return or(eq(friendships.userLowId, userId), eq(friendships.userHighId, userId));
}

/** The other account of the row, for counting only people still active. */
function otherAccount(userId: string) {
  return sql`${users.id} = case when ${friendships.userLowId} = ${userId} then ${friendships.userHighId} else ${friendships.userLowId} end`;
}

/** An account that can take part in friendships: not blocked, anonymized or deleted. */
export function activeAccount() {
  return and(isNull(users.blockedAt), isNull(users.anonymizedAt), isNull(users.deletedAt));
}

export async function isActiveAccount(db: DbExecutor, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, userId), activeAccount()))
    .limit(1);
  return row !== undefined;
}

/**
 * Serializes friendship changes that touch either person until the transaction ends: two
 * crossed requests, or several at once against the friend and pending limits. Locked in id
 * order, so two transactions never wait on each other in a circle.
 */
export async function lockPeople(db: DbExecutor, one: string, other: string) {
  for (const userId of [one, other].toSorted()) {
    await db.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${"friends:" + userId}, 0))`,
    );
  }
}

/** The pair's row, locked until the end of the transaction so two answers do not race. */
export async function lockFriendship(
  db: DbExecutor,
  one: string,
  other: string,
): Promise<ExistingFriendship | null> {
  const [row] = await db
    .select({
      status: friendships.status,
      requestedBy: friendships.requestedBy,
      dismissedAt: friendships.dismissedAt,
      privateRequest: friendships.privateRequest,
    })
    .from(friendships)
    .where(pairCondition(one, other))
    .for("update");
  if (!row) return null;
  return {
    status: row.status,
    requestedBy: row.requestedBy,
    dismissed: row.dismissedAt !== null,
    privateRequest: row.privateRequest,
  };
}

/** Whether the requester blocked the target, the target blocked the requester, or neither. */
export async function blockBetween(
  db: DbExecutor,
  requesterId: string,
  targetId: string,
): Promise<BlockState> {
  const rows = await db
    .select({ blockerId: userBlocks.blockerId })
    .from(userBlocks)
    .where(
      or(
        and(eq(userBlocks.blockerId, requesterId), eq(userBlocks.blockedId, targetId)),
        and(eq(userBlocks.blockerId, targetId), eq(userBlocks.blockedId, requesterId)),
      ),
    );
  if (rows.some((row) => row.blockerId === requesterId)) return "by_requester";
  if (rows.length > 0) return "by_target";
  return "none";
}

/** Either one blocked the other (messages and calls use this). */
export async function isBlockedEitherWay(db: DbExecutor, one: string, other: string) {
  return (await blockBetween(db, one, other)) !== "none";
}

export async function countFriends(db: DbExecutor, userId: string): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(friendships)
    .innerJoin(users, otherAccount(userId))
    .where(and(involves(userId), eq(friendships.status, "accepted"), activeAccount()));
  return row?.total ?? 0;
}

/** The friends' account ids, for nudging their lists after a change. */
export async function friendIdsOf(db: DbExecutor, userId: string): Promise<string[]> {
  const rows = await db
    .select({ low: friendships.userLowId, high: friendships.userHighId })
    .from(friendships)
    .where(and(involves(userId), eq(friendships.status, "accepted")));
  return rows.map((row) => (row.low === userId ? row.high : row.low));
}

/** Separate quotas keep blind email requests from changing observable request limits. */
export async function countPendingSent(
  db: DbExecutor,
  userId: string,
  privateRequest = false,
): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(friendships)
    .innerJoin(users, otherAccount(userId))
    .where(
      and(
        eq(friendships.requestedBy, userId),
        eq(friendships.status, "pending"),
        eq(friendships.privateRequest, privateRequest),
        activeAccount(),
      ),
    );
  return row?.total ?? 0;
}

/** A new request; a hidden one is born dismissed, so only the requester sees it. */
export async function createRequest(
  db: DbExecutor,
  requesterId: string,
  targetId: string,
  { hidden = false, privateRequest = false }: { hidden?: boolean; privateRequest?: boolean } = {},
) {
  await db
    .insert(friendships)
    .values({
      ...friendPair(requesterId, targetId),
      requestedBy: requesterId,
      privateRequest,
      dismissedAt: hidden ? sql`now()` : null,
    })
    .onConflictDoNothing();
}

/**
 * Declines quietly: the receiver stops seeing the request, the sender still sees it as
 * sent, so declining is not announced and the same request cannot be sent again at once.
 */
export async function dismissRequest(db: DbExecutor, receiverId: string, requesterId: string) {
  const dismissed = await db
    .update(friendships)
    .set({ dismissedAt: sql`now()` })
    .where(
      and(
        pairCondition(receiverId, requesterId),
        eq(friendships.status, "pending"),
        eq(friendships.requestedBy, requesterId),
        isNull(friendships.dismissedAt),
      ),
    )
    .returning({ userLowId: friendships.userLowId });
  return dismissed.length > 0;
}

export async function acceptRequest(db: DbExecutor, one: string, other: string) {
  await db
    .update(friendships)
    .set({ status: "accepted", acceptedAt: sql`now()`, dismissedAt: null })
    .where(and(pairCondition(one, other), eq(friendships.status, "pending")));
}

/** Removes the pair's row with the given status; true when there was one. */
export async function deleteFriendship(
  db: DbExecutor,
  one: string,
  other: string,
  status: ExistingFriendship["status"],
): Promise<boolean> {
  const deleted = await db
    .delete(friendships)
    .where(and(pairCondition(one, other), eq(friendships.status, status)))
    .returning({ userLowId: friendships.userLowId });
  return deleted.length > 0;
}

/**
 * Blocks and, in the same step, ends the friendship or the request between the two. A request
 * the blocked person had sent stays on their side as sent, so the block is not noticed.
 * True when something the blocked person sees went away: the friendship or a request to them.
 */
export async function blockAccount(
  db: DbExecutor,
  blockerId: string,
  blockedId: string,
): Promise<boolean> {
  await db.insert(userBlocks).values({ blockerId, blockedId }).onConflictDoNothing();
  await dismissRequest(db, blockerId, blockedId);
  const ended = await db
    .delete(friendships)
    .where(
      and(
        pairCondition(blockerId, blockedId),
        or(eq(friendships.status, "accepted"), eq(friendships.requestedBy, blockerId)),
      ),
    )
    .returning({ userLowId: friendships.userLowId });
  return ended.length > 0;
}

export async function unblockAccount(db: DbExecutor, blockerId: string, blockedId: string) {
  const deleted = await db
    .delete(userBlocks)
    .where(and(eq(userBlocks.blockerId, blockerId), eq(userBlocks.blockedId, blockedId)))
    .returning({ blockedId: userBlocks.blockedId });
  return deleted.length > 0;
}

/** Account deletion (LGPD): the anonymized row stays, so the cascade does not fire. */
export async function forgetFriendships(db: DbExecutor, userId: string) {
  await db.delete(friendships).where(involves(userId));
  await db.delete(friendLinks).where(eq(friendLinks.userId, userId));
  await retireFriendCode(db, userId);
  await db.delete(userPresence).where(eq(userPresence.userId, userId));
  await db
    .delete(userBlocks)
    .where(or(eq(userBlocks.blockerId, userId), eq(userBlocks.blockedId, userId)));
}

/** A code or call card identifies the recipient explicitly, so its request may be listed. */
export async function exposeRequest(db: DbExecutor, requesterId: string, targetId: string) {
  await db
    .update(friendships)
    .set({ privateRequest: false })
    .where(
      and(
        pairCondition(requesterId, targetId),
        eq(friendships.requestedBy, requesterId),
        eq(friendships.status, "pending"),
      ),
    );
}
