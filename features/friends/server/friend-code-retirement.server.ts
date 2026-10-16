import { eq } from "drizzle-orm";
import type { DbExecutor } from "@/server/db/index.server";
import { friendCodes, retiredFriendCodes } from "@/server/db/schema";

/**
 * Takes the account's code out of use for good: it is kept, without the account, so it is
 * never drawn again. Run inside a transaction.
 */
export async function retireFriendCode(db: DbExecutor, userId: string): Promise<void> {
  const removed = await db
    .delete(friendCodes)
    .where(eq(friendCodes.userId, userId))
    .returning({ code: friendCodes.code });
  if (removed.length === 0) return;
  await db
    .insert(retiredFriendCodes)
    .values(removed.map(({ code }) => ({ code })))
    .onConflictDoNothing();
}
