import { eq } from "drizzle-orm";
import { shownStatuses } from "@/features/friends/server/presence-status.server";
import { canMessage, membershipOf } from "@/features/messages/server/conversations.server";
import { othersByConversation } from "@/features/messages/server/conversation-list.server";
import { gifFavoriteSlugs } from "@/features/messages/server/gif-favorites.server";
import { withGifs } from "@/features/messages/server/klipy.server";
import { listMessages } from "@/features/messages/server/messages.server";
import { withAttachments } from "@/features/messages/server/attachments.server";
import { attachmentStorage } from "@/server/storage/attachment-storage.server";
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
    listMessages(db, conversationId, null, userId)
      .then(withGifs)
      .then((withGif) => withAttachments(db, attachmentStorage(), withGif)),
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
  const stillFriends = otherId !== null && (await canMessage(db, userId, otherId));
  // An old conversation never shows the status of someone who blocked or unfriended you.
  const statuses = otherId && stillFriends ? await shownStatuses(db, [otherId]) : null;
  const canSend = membership.kind === "group" || stillFriends;
  return {
    conversation: {
      id: conversationId,
      kind: membership.kind,
      name,
      others: others.get(conversationId) ?? [],
      status: otherId && statuses ? (statuses.get(otherId) ?? "offline") : null,
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
