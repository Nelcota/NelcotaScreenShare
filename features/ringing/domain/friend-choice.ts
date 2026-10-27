import type { FriendStatus } from "@/features/friends/domain/friend-lists";
import { canBeCalled } from "@/features/friends/domain/presence-status";

/**
 * The chosen friends who can still be called, in list order: someone who went Não perturbe
 * after being chosen has left the list and is not rung.
 */
export function friendsToCall(friends: readonly FriendStatus[], chosen: ReadonlySet<string>) {
  return friends
    .filter((friend) => chosen.has(friend.id) && canBeCalled(friend.status))
    .map((friend) => friend.id);
}
