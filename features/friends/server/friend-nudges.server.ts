import { friendIdsOf } from "@/features/friends/server/friendships.server";
import { chosenStatus } from "@/features/friends/server/presence-status.server";
import { notifyUsers } from "@/features/live/server/live-bus.server";
import type { DbExecutor } from "@/server/db/index.server";

/** After a change both sides see in their lists. Call it after the transaction commits. */
export function nudgeFriendLists(userIds: string[]): void {
  notifyUsers(userIds, "friends");
}

/** A new chosen status: your other tabs and your friends' lists. */
export async function nudgeStatusChange(db: DbExecutor, userId: string): Promise<void> {
  notifyUsers([userId, ...(await friendIdsOf(db, userId))], "status");
}

/** Came online or went offline: friends reload, unless the person is invisible to them. */
export async function announcePresence(db: DbExecutor, userId: string): Promise<void> {
  if ((await chosenStatus(db, userId)) === "invisible") return;
  notifyUsers(await friendIdsOf(db, userId), "status");
}
