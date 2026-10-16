/** Friends per account: plenty for everyday use and a ceiling against abuse. */
export const MAX_FRIENDS = 500;
/** Requests waiting for an answer that one account may have sent. */
export const MAX_PENDING_SENT = 50;

export interface FriendPair {
  userLowId: string;
  userHighId: string;
}

/** The two accounts in id order, as the `friendships` row stores them. */
export function friendPair(one: string, other: string): FriendPair {
  if (one < other) return { userLowId: one, userHighId: other };
  return { userLowId: other, userHighId: one };
}

export interface ExistingFriendship {
  status: "pending" | "accepted";
  requestedBy: string;
  /** A pending request the receiver no longer sees (declined, or sent by someone blocked). */
  dismissed?: boolean;
  privateRequest?: boolean;
}

/** How a friendship's state reads in "Baixar meus dados". */
export const FRIENDSHIP_STATUS_IN_EXPORT: Record<ExistingFriendship["status"], string> = {
  pending: "pendente",
  accepted: "aceita",
};

/** Who blocked whom between the two people of a request. */
export type BlockState = "none" | "by_requester" | "by_target";

/** What is known when someone asks to be friends. */
export interface FriendRequestState {
  requesterId: string;
  targetId: string;
  existing: ExistingFriendship | null;
  blocked: BlockState;
  requesterFriends: number;
  targetFriends: number;
  requesterPendingSent: number;
}

export type FriendRequestOutcome =
  /** New pending request. */
  | "create"
  /** The other person had already asked: this request accepts theirs. */
  | "accept"
  /** Nothing to do, and the requester sees "request sent" (a block stays hidden). */
  | "already_sent"
  | "already_friends"
  /** The target blocked the requester: a request they never see, shown to the requester as sent. */
  | "hidden"
  | "ignored"
  | "self"
  | "friend_limit"
  | "pending_limit";

/**
 * Decides a friend request. A block is answered like an ordinary sent request, so the
 * blocked person never learns about it.
 */
export function decideFriendRequest(state: FriendRequestState): FriendRequestOutcome {
  if (state.requesterId === state.targetId) return "self";
  if (state.blocked === "by_requester") return "ignored";
  if (state.blocked === "by_target") return state.existing ? "ignored" : "hidden";
  if (state.existing?.status === "accepted") return "already_friends";
  if (state.existing?.requestedBy === state.requesterId) return "already_sent";
  const limitReached = state.requesterFriends >= MAX_FRIENDS || state.targetFriends >= MAX_FRIENDS;
  if (limitReached) return "friend_limit";
  if (state.existing) return "accept";
  if (state.requesterPendingSent >= MAX_PENDING_SENT) return "pending_limit";
  return "create";
}

/** A pending request can only be answered by the person who received it. */
export function canAnswer(existing: ExistingFriendship | null, answererId: string): boolean {
  if (!existing || existing.dismissed) return false;
  return existing.status === "pending" && existing.requestedBy !== answererId;
}
