import {
  decideFriendRequest,
  type FriendRequestOutcome,
} from "@/features/friends/domain/friendship";
import {
  acceptRequest,
  blockBetween,
  countFriends,
  countPendingSent,
  createRequest,
  lockFriendship,
  lockPeople,
} from "@/features/friends/server/friendships.server";
import type { DbExecutor } from "@/server/db/index.server";

/**
 * Decides a friend request and applies it: creates it, or accepts it when the other person
 * had already asked. Run inside a transaction; the caller turns limits into messages.
 */
export async function requestFriendship(
  tx: DbExecutor,
  requesterId: string,
  targetId: string,
): Promise<FriendRequestOutcome> {
  await lockPeople(tx, requesterId, targetId);
  const outcome = decideFriendRequest({
    requesterId,
    targetId,
    existing: await lockFriendship(tx, requesterId, targetId),
    blocked: await blockBetween(tx, requesterId, targetId),
    requesterFriends: await countFriends(tx, requesterId),
    targetFriends: await countFriends(tx, targetId),
    requesterPendingSent: await countPendingSent(tx, requesterId),
  });
  if (outcome === "create") await createRequest(tx, requesterId, targetId);
  if (outcome === "hidden") await createRequest(tx, requesterId, targetId, { hidden: true });
  if (outcome === "accept") await acceptRequest(tx, requesterId, targetId);
  return outcome;
}
