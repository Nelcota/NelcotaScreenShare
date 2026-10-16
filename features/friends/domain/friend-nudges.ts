import type { FriendRequestOutcome } from "@/features/friends/domain/friendship";

/**
 * Who reloads after a friend request: the requester's own tabs always, the target only when
 * a request or a friendship shows up for them. A hidden request (block) or an e-mail with no
 * account nudges nobody else, so neither can be noticed.
 */
export function requestNudgeTargets(
  requesterId: string,
  targetId: string | undefined,
  outcome: FriendRequestOutcome,
): string[] {
  const reachesTarget = outcome === "create" || outcome === "accept";
  if (!targetId || !reachesTarget) return [requesterId];
  return [requesterId, targetId];
}
