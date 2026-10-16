import { and, count, eq, or } from "drizzle-orm";
import type { DbExecutor } from "@/server/db/index.server";
import { friendships, userBlocks } from "@/server/db/schema";

/** Only how many: never who the friends are or who blocked whom. */
export interface SocialCounts {
  friends: number;
  blocksMade: number;
  blocksReceived: number;
}

async function friendCount(db: DbExecutor, userId: string): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(friendships)
    .where(
      and(
        eq(friendships.status, "accepted"),
        or(eq(friendships.userLowId, userId), eq(friendships.userHighId, userId)),
      ),
    );
  return row?.total ?? 0;
}

async function blockCount(db: DbExecutor, side: "made" | "received", userId: string) {
  const column = side === "made" ? userBlocks.blockerId : userBlocks.blockedId;
  const [row] = await db.select({ total: count() }).from(userBlocks).where(eq(column, userId));
  return row?.total ?? 0;
}

export async function socialCounts(db: DbExecutor, userId: string): Promise<SocialCounts> {
  const [friends, blocksMade, blocksReceived] = await Promise.all([
    friendCount(db, userId),
    blockCount(db, "made", userId),
    blockCount(db, "received", userId),
  ]);
  return { friends, blocksMade, blocksReceived };
}
