import {
  decideFriendRequest,
  MAX_PENDING_SENT,
  type FriendRequestOutcome,
} from "@/features/friends/domain/friendship";
import {
  acceptRequest,
  blockBetween,
  countFriends,
  countPendingSent,
  createRequest,
  exposeRequest,
  lockFriendship,
  lockPeople,
  reviveRequest,
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
  privateRequest = false,
): Promise<FriendRequestOutcome> {
  await lockPeople(tx, requesterId, targetId);
  const existing = await lockFriendship(tx, requesterId, targetId);
  const pending = await countPendingSent(tx, requesterId, privateRequest);
  if (
    !privateRequest &&
    existing?.status === "pending" &&
    existing.requestedBy === requesterId &&
    existing.privateRequest &&
    pending >= MAX_PENDING_SENT
  )
    return "pending_limit";
  const outcome = decideFriendRequest({
    requesterId,
    targetId,
    existing,
    blocked: await blockBetween(tx, requesterId, targetId),
    requesterFriends: await countFriends(tx, requesterId),
    targetFriends: await countFriends(tx, targetId),
    requesterPendingSent: pending,
  });
  if (outcome === "create") await createRequest(tx, requesterId, targetId, { privateRequest });
  if (outcome === "hidden")
    await createRequest(tx, requesterId, targetId, { hidden: true, privateRequest });
  if (outcome === "accept") await acceptRequest(tx, requesterId, targetId);
  if (outcome === "already_sent") {
    if (!privateRequest) await exposeRequest(tx, requesterId, targetId);
    if (existing?.withdrawn) await reviveRequest(tx, requesterId, targetId);
  }
  return outcome;
}
