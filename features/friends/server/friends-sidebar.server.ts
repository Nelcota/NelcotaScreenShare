import { parseColumnLayout } from "@/features/friends/domain/column-layout";
import { formatFriendCode } from "@/features/friends/domain/friend-code";
import { friendLinkPath } from "@/features/friends/domain/friend-link";
import { friendCode } from "@/features/friends/server/friend-codes.server";
import { friendLinkToken } from "@/features/friends/server/friend-links.server";
import { friendLists } from "@/features/friends/server/friend-list.server";
import { chosenStatus, shownStatuses } from "@/features/friends/server/presence-status.server";
import { columnConversations } from "@/features/messages/server/conversation-list.server";
import type { DbExecutor } from "@/server/db/index.server";

/**
 * Everything the friends column draws for a signed-in person, on any page that shows it:
 * the app today, the room and its screens next.
 */
export async function friendsSidebarData(
  db: DbExecutor,
  user: { id: string; name: string; image?: string | null },
  request: Request,
) {
  const [lists, code, token, ownStatus, conversations] = await Promise.all([
    friendLists(db, user.id),
    friendCode(db, user.id),
    friendLinkToken(db, user.id),
    chosenStatus(db, user.id),
    columnConversations(db, user.id),
  ]);
  const statuses = await shownStatuses(
    db,
    lists.friends.map((friend) => friend.id),
  );
  return {
    account: { name: user.name, image: user.image ?? null },
    friends: lists.friends.map((friend) => ({
      ...friend,
      status: statuses.get(friend.id) ?? ("offline" as const),
    })),
    ownStatus,
    unreadByFriend: conversations.unreadByFriend,
    groups: conversations.groups,
    requests: lists.received.length,
    code: formatFriendCode(code),
    linkPath: friendLinkPath(token),
    columnLayout: parseColumnLayout(request.headers.get("cookie")),
  };
}

export type FriendsSidebarData = Awaited<ReturnType<typeof friendsSidebarData>>;
