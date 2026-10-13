import type { ShownStatus } from "@/features/friends/domain/presence-status";

export interface FriendPerson {
  id: string;
  name: string;
}

export interface FriendLists {
  friends: FriendPerson[];
  received: FriendPerson[];
  sent: FriendPerson[];
  blocked: FriendPerson[];
}

export type FriendRelation = "self" | "friends" | "sent" | "received" | "blocked" | "none";

/** Where the friends lists load someone's photo. */
export function friendPhotoPath(userId: string): string {
  return `/api/amigos/foto?${new URLSearchParams({ pessoa: userId }).toString()}`;
}

/** A friend in the column: the status they show, never where they are. */
export interface FriendStatus extends FriendPerson {
  status: ShownStatus;
}

/** Online first, then by name. */
export function splitByPresence(friends: FriendStatus[]): {
  online: FriendStatus[];
  offline: FriendStatus[];
} {
  return {
    online: friends.filter((friend) => friend.status !== "offline"),
    offline: friends.filter((friend) => friend.status === "offline"),
  };
}
