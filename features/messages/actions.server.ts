import { z } from "zod";
import { defineUserOperation } from "@/features/auth/server/operation-policies.server";
import {
  decideGroupCreation,
  GIF_SLUG_PATTERN,
  inviteesOf,
  MAX_GROUP_MEMBERS,
  MAX_GROUP_NAME_LENGTH,
  MAX_MESSAGE_LENGTH,
  normalizeGroupName,
  normalizeMessageBody,
} from "@/features/messages/domain/conversation";
import { conversationList } from "@/features/messages/server/conversation-list.server";
import {
  canMessage,
  createGroup,
  leaveGroup as leaveGroupRows,
  markRead,
  memberIdsOf,
  membershipOf,
  messageableFriends,
  openDirect,
  type Membership,
} from "@/features/messages/server/conversations.server";
import {
  deleteOwnMessage,
  insertMessage,
  listMessages as listMessageRows,
  type MessageContent,
} from "@/features/messages/server/messages.server";
import { notifyUsers } from "@/features/live/server/live-bus.server";
import { withGifs } from "@/features/messages/server/klipy.server";
import { getDb, type DbExecutor } from "@/server/db/index.server";
import { ActionError } from "@/server/operations/action-error";
import { createRateLimiter } from "@/server/rate-limit.server";

const personSchema = z.object({ userId: z.uuid() });
const conversationSchema = z.object({ conversationId: z.uuid() });
const groupSchema = z.object({
  memberIds: z
    .array(z.uuid())
    .min(1)
    .max(MAX_GROUP_MEMBERS * 2),
  name: z.string().max(MAX_GROUP_NAME_LENGTH).nullish(),
});
const sendSchema = z.union([
  z.object({ conversationId: z.uuid(), body: z.string().max(MAX_MESSAGE_LENGTH * 2) }),
  z.object({ conversationId: z.uuid(), gifSlug: z.string().regex(GIF_SLUG_PATTERN) }),
]);
const pageSchema = z.object({ conversationId: z.uuid(), beforeId: z.uuid().nullish() });
const messageSchema = z.object({ messageId: z.uuid() });

/** Enough for a lively chat, too little for a flood. */
const sendLimiter = createRateLimiter({ limit: 30, windowMs: 60_000 });
const groupLimiter = createRateLimiter({ limit: 10, windowMs: 60 * 60_000 });

/** Nudges the open tabs of these people after the commit: their list and unread count change. */
function nudge(userIds: readonly string[]) {
  notifyUsers(userIds, "messages");
}

const NOT_FOUND = "Conversa não encontrada.";
const FRIENDS_ONLY = "Só dá para mandar mensagem para amigos.";

async function requireMembership(db: DbExecutor, conversationId: string, userId: string) {
  const membership = await membershipOf(db, conversationId, userId);
  if (!membership) throw new ActionError(NOT_FOUND);
  return membership;
}

/** A direct conversation only takes new messages while the two are still friends. */
async function requireCanSend(db: DbExecutor, membership: Membership, userId: string) {
  if (membership.kind === "group") return;
  if (!membership.otherId) throw new ActionError(FRIENDS_ONLY);
  if (!(await canMessage(db, userId, membership.otherId))) throw new ActionError(FRIENDS_ONLY);
}

function contentOf(input: z.output<typeof sendSchema>): MessageContent {
  if ("gifSlug" in input) return { body: null, gifSlug: input.gifSlug };
  const body = normalizeMessageBody(input.body);
  if (!body) throw new ActionError("Escreva uma mensagem.");
  if (body.length > MAX_MESSAGE_LENGTH) {
    throw new ActionError(`A mensagem passa de ${MAX_MESSAGE_LENGTH} caracteres.`);
  }
  return { body, gifSlug: null };
}

/** Opens (or creates) the direct conversation with a friend. */
export const openDirectConversation = defineUserOperation(
  { name: "messages.open_direct", audit: "none" },
  personSchema,
  async ({ parsedInput, ctx }) => {
    const userId = ctx.current.user.id;
    if (parsedInput.userId === userId) throw new ActionError("Esse é você.");
    const result = await getDb().transaction(async (tx) => {
      if (!(await canMessage(tx, userId, parsedInput.userId))) {
        throw new ActionError(FRIENDS_ONLY);
      }
      return { conversationId: await openDirect(tx, userId, parsedInput.userId) };
    });
    nudge([userId]);
    return result;
  },
);

/** A group of up to 10 people, all of them friends of whoever creates it. */
export const createGroupConversation = defineUserOperation(
  { name: "messages.create_group", audit: "required" },
  groupSchema,
  async ({ parsedInput, ctx }) => {
    const creatorId = ctx.current.user.id;
    if (!groupLimiter.hit(creatorId).ok) {
      throw new ActionError("Muitos grupos seguidos. Tente de novo mais tarde.");
    }
    const invitees = inviteesOf(creatorId, parsedInput.memberIds);
    const result = await getDb().transaction(async (tx) => {
      const outcome = decideGroupCreation({
        creatorId,
        memberIds: invitees,
        friendIds: await messageableFriends(tx, creatorId, invitees.slice(0, MAX_GROUP_MEMBERS)),
      });
      if (outcome === "too_few") throw new ActionError("Escolha pelo menos dois amigos.");
      if (outcome === "too_many") {
        throw new ActionError(`Um grupo tem até ${MAX_GROUP_MEMBERS} pessoas.`);
      }
      if (outcome === "not_friends") throw new ActionError("Escolha só amigos.");
      const conversationId = await createGroup(
        tx,
        creatorId,
        invitees,
        normalizeGroupName(parsedInput.name),
      );
      await ctx.audit.record(tx, {
        action: "conversation.group_create",
        resourceType: "conversation",
        resourceId: conversationId,
        metadata: { members: invitees.length + 1 },
      });
      return { conversationId };
    });
    nudge([creatorId, ...invitees]);
    return result;
  },
);

export const sendMessage = defineUserOperation(
  { name: "messages.send", audit: "none" },
  sendSchema,
  async ({ parsedInput, ctx }) => {
    const authorId = ctx.current.user.id;
    if (!sendLimiter.hit(authorId).ok) {
      throw new ActionError("Muitas mensagens seguidas. Espere um pouco.");
    }
    const content = contentOf(parsedInput);
    const sent = await getDb().transaction(async (tx) => {
      const membership = await requireMembership(tx, parsedInput.conversationId, authorId);
      await requireCanSend(tx, membership, authorId);
      const message = await insertMessage(tx, parsedInput.conversationId, authorId, content);
      const members = await memberIdsOf(tx, parsedInput.conversationId);
      return { messageId: message.id, createdAt: message.createdAt, members };
    });
    nudge(sent.members);
    return { messageId: sent.messageId, createdAt: sent.createdAt };
  },
);

export const listMessages = defineUserOperation(
  { name: "messages.list", audit: "none" },
  pageSchema,
  async ({ parsedInput, ctx }) => {
    const db = getDb();
    await requireMembership(db, parsedInput.conversationId, ctx.current.user.id);
    return withGifs(
      await listMessageRows(db, parsedInput.conversationId, parsedInput.beforeId ?? null),
    );
  },
);

export const listConversations = defineUserOperation(
  { name: "messages.conversations", audit: "none" },
  z.object({}),
  async ({ ctx }) => ({ conversations: await conversationList(getDb(), ctx.current.user.id) }),
);

/** Each person deletes only their own messages; it disappears for everyone. */
export const deleteMessage = defineUserOperation(
  { name: "messages.delete", audit: "none" },
  messageSchema,
  async ({ parsedInput, ctx }) => {
    const members = await getDb().transaction(async (tx) => {
      const conversationId = await deleteOwnMessage(tx, parsedInput.messageId, ctx.current.user.id);
      return conversationId ? memberIdsOf(tx, conversationId) : null;
    });
    if (!members) throw new ActionError("Mensagem não encontrada.");
    nudge(members);
    return { deleted: true };
  },
);

export const markConversationRead = defineUserOperation(
  { name: "messages.mark_read", audit: "none" },
  conversationSchema,
  async ({ parsedInput, ctx }) => {
    const db = getDb();
    await requireMembership(db, parsedInput.conversationId, ctx.current.user.id);
    await markRead(db, parsedInput.conversationId, ctx.current.user.id);
    nudge([ctx.current.user.id]);
    return { read: true };
  },
);

export const leaveGroup = defineUserOperation(
  { name: "messages.leave_group", audit: "none" },
  conversationSchema,
  async ({ parsedInput, ctx }) => {
    const userId = ctx.current.user.id;
    const members = await getDb().transaction(async (tx) => {
      const membership = await requireMembership(tx, parsedInput.conversationId, userId);
      if (membership.kind !== "group") throw new ActionError(NOT_FOUND);
      const before = await memberIdsOf(tx, parsedInput.conversationId);
      await leaveGroupRows(tx, parsedInput.conversationId, userId);
      return before;
    });
    nudge(members);
    return { left: true };
  },
);
