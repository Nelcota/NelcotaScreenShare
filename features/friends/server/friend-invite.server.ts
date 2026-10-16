import type { FriendRelation } from "@/features/friends/domain/friend-lists";
import { ownerOfFriendLink } from "@/features/friends/server/friend-links.server";
import { publicProfile, relationTo } from "@/features/friends/server/friend-list.server";
import type { DbExecutor } from "@/server/db/index.server";

export type FriendInvite =
  | { status: "expired" }
  | {
      status: "open";
      person: { id: string; name: string; image: string | null };
      relation: FriendRelation;
    };

/** Who sent this friend link, and how the viewer relates to them; null-safe for old links. */
export async function friendInvite(
  db: DbExecutor,
  viewerId: string | null,
  token: string,
): Promise<FriendInvite> {
  const ownerId = await ownerOfFriendLink(db, token);
  if (!ownerId) return { status: "expired" };
  const person = await publicProfile(db, ownerId);
  if (!person) return { status: "expired" };
  const relation = viewerId ? await relationTo(db, viewerId, ownerId) : "none";
  return { status: "open", person, relation };
}
