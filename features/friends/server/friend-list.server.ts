import { and, asc, count, eq, isNull, ne, or, sql } from "drizzle-orm";
import type {
  FriendLists,
  FriendPerson,
  FriendRelation,
} from "@/features/friends/domain/friend-lists";
import type { DbExecutor } from "@/server/db/index.server";
import { friendships, userBlocks, users } from "@/server/db/schema";

const activeUser = and(
  isNull(users.blockedAt),
  isNull(users.anonymizedAt),
  isNull(users.deletedAt),
);

function person({ id, name }: FriendPerson): FriendPerson {
  return { id, name };
}

function otherSide(userId: string) {
  return sql`case when ${friendships.userLowId} = ${userId} then ${friendships.userHighId} else ${friendships.userLowId} end`;
}

/** Unaccepted email lookups are visible to their recipient, never to their sender. */
export function visibleFriendshipTo(viewerId: string) {
  return or(
    eq(friendships.status, "accepted"),
    ne(friendships.requestedBy, viewerId),
    eq(friendships.privateRequest, false),
  );
}

/** Everyone on the friends page, sorted by name; accounts that left are hidden. */
export async function friendLists(db: DbExecutor, userId: string): Promise<FriendLists> {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      status: friendships.status,
      requestedBy: friendships.requestedBy,
      dismissedAt: friendships.dismissedAt,
    })
    .from(friendships)
    .innerJoin(users, eq(users.id, otherSide(userId)))
    .where(
      and(
        or(eq(friendships.userLowId, userId), eq(friendships.userHighId, userId)),
        activeUser,
        visibleFriendshipTo(userId),
      ),
    )
    .orderBy(asc(users.name));
  const blocked = await db
    .select({ id: users.id, name: users.name })
    .from(userBlocks)
    .innerJoin(users, eq(users.id, userBlocks.blockedId))
    .where(and(eq(userBlocks.blockerId, userId), activeUser))
    .orderBy(asc(users.name));

  return {
    friends: rows.filter((row) => row.status === "accepted").map(person),
    // Declined or hidden requests leave the receiver's list; the sender keeps seeing them.
    received: rows
      .filter((row) => row.status === "pending" && row.requestedBy !== userId && !row.dismissedAt)
      .map(person),
    sent: rows.filter((row) => row.status === "pending" && row.requestedBy === userId).map(person),
    blocked,
  };
}

/** Requests waiting for this account's answer (the dot on the avatar). */
export async function pendingReceivedCount(db: DbExecutor, userId: string): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(friendships)
    .innerJoin(users, eq(users.id, otherSide(userId)))
    .where(
      and(
        or(eq(friendships.userLowId, userId), eq(friendships.userHighId, userId)),
        eq(friendships.status, "pending"),
        ne(friendships.requestedBy, userId),
        isNull(friendships.dismissedAt),
        activeUser,
      ),
    );
  return row?.total ?? 0;
}

/** How the viewer relates to someone, for the friend link page. */
export async function relationTo(
  db: DbExecutor,
  viewerId: string,
  otherId: string,
): Promise<FriendRelation> {
  if (viewerId === otherId) return "self";
  const [block] = await db
    .select({ blockerId: userBlocks.blockerId })
    .from(userBlocks)
    .where(and(eq(userBlocks.blockerId, viewerId), eq(userBlocks.blockedId, otherId)));
  if (block) return "blocked";
  const [row] = await db
    .select({
      status: friendships.status,
      requestedBy: friendships.requestedBy,
      dismissedAt: friendships.dismissedAt,
    })
    .from(friendships)
    .where(
      and(
        or(
          and(eq(friendships.userLowId, viewerId), eq(friendships.userHighId, otherId)),
          and(eq(friendships.userLowId, otherId), eq(friendships.userHighId, viewerId)),
        ),
        visibleFriendshipTo(viewerId),
      ),
    );
  if (!row) return "none";
  if (row.status === "accepted") return "friends";
  if (row.requestedBy === viewerId) return "sent";
  if (row.dismissedAt) return "none";
  return "received";
}

/** Name and photo of an active account, for the friend link page. */
export async function publicProfile(db: DbExecutor, userId: string) {
  const [row] = await db
    .select({ id: users.id, name: users.name, image: users.image })
    .from(users)
    .where(and(eq(users.id, userId), activeUser));
  return row ?? null;
}

/** A friend's card: name and the day you became friends. Null when not friends (any more). */
export async function friendCard(
  db: DbExecutor,
  viewerId: string,
  friendId: string,
): Promise<{ id: string; name: string; since: Date } | null> {
  if (viewerId === friendId) return null;
  const [row] = await db
    .select({ id: users.id, name: users.name, since: friendships.acceptedAt })
    .from(friendships)
    .innerJoin(users, eq(users.id, friendId))
    .where(
      and(
        or(
          and(eq(friendships.userLowId, viewerId), eq(friendships.userHighId, friendId)),
          and(eq(friendships.userLowId, friendId), eq(friendships.userHighId, viewerId)),
        ),
        eq(friendships.status, "accepted"),
        activeUser,
      ),
    );
  if (!row?.since) return null;
  return { id: row.id, name: row.name, since: row.since };
}
