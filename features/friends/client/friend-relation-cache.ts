import { friendRelation } from "@/features/friends/actions";
import type { FriendRelation } from "@/features/friends/domain/friend-lists";

/** The last answer per person in this tab: a card opens with it while it checks again. */
const known = new Map<string, FriendRelation>();
const inFlight = new Map<string, Promise<FriendRelation | null>>();

export function knownFriendRelation(userId: string): FriendRelation | null {
  return known.get(userId) ?? null;
}

export function rememberFriendRelation(userId: string, relation: FriendRelation): void {
  known.set(userId, relation);
}

/** Asks the server, sharing a request already on its way (a hover, then the click). */
export function loadFriendRelation(userId: string): Promise<FriendRelation | null> {
  const pending = inFlight.get(userId);
  if (pending) return pending;
  const request = (async () => {
    try {
      const result = await friendRelation({ userId });
      if (!result.data) return null;
      known.set(userId, result.data.relation);
      return result.data.relation;
    } finally {
      inFlight.delete(userId);
    }
  })();
  inFlight.set(userId, request);
  return request;
}
