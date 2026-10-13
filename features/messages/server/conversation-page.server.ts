import { eq } from "drizzle-orm";
import { shownStatuses } from "@/features/friends/server/presence-status.server";
import { canMessage, membershipOf } from "@/features/messages/server/conversations.server";
import { othersByConversation } from "@/features/messages/server/conversation-list.server";
import { gifFavoriteSlugs } from "@/features/messages/server/gif-favorites.server";
import { withGifs } from "@/features/messages/server/klipy.server";
import { listMessages } from "@/features/messages/server/messages.server";
import { groupCallLines, liveGroupCall } from "@/features/ringing/server/group-calls.server";
import type { DbExecutor } from "@/server/db/index.server";
import { conversations } from "@/server/db/schema";

async function conversationName(db: DbExecutor, conversationId: string) {
  const [row] = await db
    .select({ name: conversations.name })
    .from(conversations)
    .where(eq(conversations.id, conversationId));
  return row?.name ?? null;
}

/**
 * Everything the open conversation draws: who is in it, the newest page of messages,
 * whether it still takes messages and the GIF favourites. Null for a non-member.
 */
export async function conversationPage(db: DbExecutor, userId: string, conversationId: string) {
  const membership = await membershipOf(db, conversationId, userId);
  if (!membership) return null;
  const [name, others, page, gifFavorites] = await Promise.all([
    conversationName(db, conversationId),
    othersByConversation(db, userId, [conversationId]),
    listMessages(db, conversationId, null).then(withGifs),
    gifFavoriteSlugs(db, userId),
  ]);
  const otherId = membership.otherId;
  const group = membership.kind === "group";
  const oldest = page.messages[0]?.createdAt ?? new Date(0);
  const [groupCall, callLines] = group
    ? await Promise.all([
        liveGroupCall(db, conversationId),
        groupCallLines(db, conversationId, page.hasMore ? oldest : new Date(0)),
      ])
    : [null, []];
  const statuses = otherId ? await shownStatuses(db, [otherId]) : null;
  const canSend =
    membership.kind === "group" || (otherId !== null && (await canMessage(db, userId, otherId)));
  return {
    conversation: {
      id: conversationId,
      kind: membership.kind,
      name,
      others: others.get(conversationId) ?? [],
      status: otherId ? (statuses?.get(otherId) ?? "offline") : null,
    },
    messages: page.messages,
    hasMore: page.hasMore,
    canSend,
    gifFavorites,
    groupCall,
    calls: callLines.map((line) => ({
      type: "call" as const,
      id: line.id,
      starterName: line.starterName ?? "Alguém",
      createdAt: line.startedAt,
    })),
  };
}
