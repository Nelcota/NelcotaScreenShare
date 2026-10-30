import type { FriendStatus } from "@/features/friends/domain/friend-lists";
import { canBeCalled } from "@/features/friends/domain/presence-status";

/**
 * Picks the chosen friends who can still be called, in list order: someone who went
 * Não perturbe after being chosen has left the list and is not rung.
 *
 * @param friends - The friend list as it is now, with each friend's current status.
 * @param chosen - The ids picked in the window.
 * @returns The ids to ring, in the friend list's order.
 */
export function friendsToCall(friends: readonly FriendStatus[], chosen: ReadonlySet<string>) {
  return friends
    .filter((friend) => chosen.has(friend.id) && canBeCalled(friend.status))
    .map((friend) => friend.id);
}
