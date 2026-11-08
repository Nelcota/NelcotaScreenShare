import type { FriendStatus } from "@/features/friends/domain/friend-lists";

/**
 * Picks the chosen friends who can still be called, in list order: rung while Online or
 * Ausente, a missed call while Offline. Someone who went Não perturbe after being chosen has
 * left the list and is not called.
 *
 * @param friends - The friend list as it is now, with each friend's current status.
 * @param chosen - The ids picked in the window.
 * @returns The ids to call, in the friend list's order.
 */
export function friendsToCall(friends: readonly FriendStatus[], chosen: ReadonlySet<string>) {
  return friends
    .filter((friend) => chosen.has(friend.id) && friend.status !== "busy")
    .map((friend) => friend.id);
}
