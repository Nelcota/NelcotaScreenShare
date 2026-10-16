import { and, asc, inArray, isNull } from "drizzle-orm";
import { formatFriendCode } from "@/features/friends/domain/friend-code";
import type { FriendPerson } from "@/features/friends/domain/friend-lists";
import { friendCode } from "@/features/friends/server/friend-codes.server";
import { friendCard } from "@/features/friends/server/friend-list.server";
import { friendIdsOf } from "@/features/friends/server/friendships.server";
import type { DbExecutor } from "@/server/db/index.server";
import { users } from "@/server/db/schema";

/** How many mutual friends the profile draws; the count covers the rest. */
const MUTUAL_SHOWN = 6;

/** Friends both people have, active accounts only, by name. */
async function mutualFriends(db: DbExecutor, viewerId: string, friendId: string) {
  const [mine, theirs] = await Promise.all([friendIdsOf(db, viewerId), friendIdsOf(db, friendId)]);
  const theirSet = new Set(theirs);
  const shared = mine.filter((id) => theirSet.has(id));
  if (shared.length === 0) return [];
  return db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(
      and(
        inArray(users.id, shared),
        isNull(users.blockedAt),
        isNull(users.anonymizedAt),
        isNull(users.deletedAt),
      ),
    )
    .orderBy(asc(users.name));
}

export interface FriendProfile {
  id: string;
  name: string;
  /** Their friend code as people share it ("NELC-XXXXXX"), under the name; never the e-mail. */
  code: string;
  since: Date;
  mutual: { shown: FriendPerson[]; total: number };
}

/** The profile beside a conversation: only for someone who is still a friend. */
export async function friendProfile(
  db: DbExecutor,
  viewerId: string,
  friendId: string,
): Promise<FriendProfile | null> {
  const card = await friendCard(db, viewerId, friendId);
  if (!card) return null;
  const [code, mutual] = await Promise.all([
    friendCode(db, friendId),
    mutualFriends(db, viewerId, friendId),
  ]);
  return {
    ...card,
    code: formatFriendCode(code),
    mutual: { shown: mutual.slice(0, MUTUAL_SHOWN), total: mutual.length },
  };
}
