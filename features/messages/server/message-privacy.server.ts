import { and, asc, desc, eq, isNotNull, sql } from "drizzle-orm";
import type { DbExecutor } from "@/server/db/index.server";
import {
  conversationMembers,
  conversations,
  gifFavorites,
  messageAttachments,
  messages,
  users,
} from "@/server/db/schema";
import { CONVERSATION_KIND_IN_EXPORT } from "@/features/messages/domain/conversation";
import { deleteEmptyGroups } from "./conversations.server";
import { refreshLastMessageAt } from "./messages.server";

/** "With whom": the other members' names, for the export. */
function otherMembersOf(userId: string) {
  return sql<string[]>`array(
    select ${users.name} from ${conversationMembers} cm
    join ${users} on ${users.id} = cm.user_id
    where cm.conversation_id = ${conversations.id} and cm.user_id <> ${userId}
    order by ${users.name}
  )`;
}

/**
 * The messages part of "Baixar meus dados" (LGPD, art. 18): the conversations the person is
 * in, every message they sent and their favourite GIFs. Others' messages belong to their authors.
 */
export async function messageData(db: DbExecutor, userId: string) {
  const conversationRows = await db
    .select({
      id: conversations.id,
      tipo: conversations.kind,
      nome: conversations.name,
      com: otherMembersOf(userId),
      entrou_em: conversationMembers.joinedAt,
    })
    .from(conversationMembers)
    .innerJoin(conversations, eq(conversations.id, conversationMembers.conversationId))
    .where(eq(conversationMembers.userId, userId))
    .orderBy(asc(conversationMembers.joinedAt));
  const sent = await db
    .select({
      conversa: messages.conversationId,
      texto: messages.body,
      gif: messages.gifSlug,
      enviada_em: messages.createdAt,
    })
    .from(messages)
    .where(eq(messages.authorId, userId))
    .orderBy(asc(messages.createdAt));
  const files = await db
    .select({
      conversa: messageAttachments.conversationId,
      nome: messageAttachments.fileName,
      tipo: messageAttachments.kind,
      tamanho_bytes: messageAttachments.sizeBytes,
      enviado_em: messageAttachments.confirmedAt,
    })
    .from(messageAttachments)
    .where(
      and(
        eq(messageAttachments.uploaderId, userId),
        eq(messageAttachments.status, "ready"),
        isNotNull(messageAttachments.messageId),
      ),
    )
    .orderBy(asc(messageAttachments.confirmedAt));
  const favorites = await db
    .select({ gif: gifFavorites.slug, salvo_em: gifFavorites.createdAt })
    .from(gifFavorites)
    .where(eq(gifFavorites.userId, userId))
    .orderBy(desc(gifFavorites.createdAt));
  return {
    conversas: conversationRows.map((row) => ({
      ...row,
      tipo: CONVERSATION_KIND_IN_EXPORT[row.tipo],
    })),
    mensagens_enviadas: sent,
    // The files themselves are downloaded from the conversation; here, what was sent.
    arquivos_enviados: files,
    gifs_favoritos: favorites,
  };
}

/**
 * Account deletion (LGPD): the anonymized row stays, so the cascade does not fire. Their
 * messages, favourites and memberships go; groups left empty go with them. A direct
 * conversation keeps the other person's messages, which are theirs.
 */
export async function forgetMessages(db: DbExecutor, userId: string) {
  const touched = await db
    .delete(messages)
    .where(eq(messages.authorId, userId))
    .returning({ conversationId: messages.conversationId });
  const memberships = await db
    .delete(conversationMembers)
    .where(eq(conversationMembers.userId, userId))
    .returning({ conversationId: conversationMembers.conversationId });
  await db.delete(gifFavorites).where(eq(gifFavorites.userId, userId));
  // Their files lose their sender: unreachable now, erased by the next maintenance sweep.
  await db
    .update(messageAttachments)
    .set({ uploaderId: null })
    .where(eq(messageAttachments.uploaderId, userId));
  const conversationIds = [
    ...new Set([...touched, ...memberships].map((row) => row.conversationId)),
  ];
  await deleteEmptyGroups(db, conversationIds);
  for (const conversationId of conversationIds) {
    await refreshLastMessageAt(db, conversationId);
  }
}
