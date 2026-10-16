import { z } from "zod";
import { canAnswer, MAX_FRIENDS } from "@/features/friends/domain/friendship";
import {
  acceptRequest,
  blockAccount,
  countFriends,
  deleteFriendship,
  withdrawRequest,
  dismissRequest,
  isActiveAccount,
  lockFriendship,
  lockPeople,
  unblockAccount,
} from "@/features/friends/server/friendships.server";
import { requestFriendship } from "@/features/friends/server/request-friendship.server";
import { nudgeFriendLists } from "@/features/friends/server/friend-nudges.server";
import { requestNudgeTargets } from "@/features/friends/domain/friend-nudges";
import { relationTo } from "@/features/friends/server/friend-list.server";
import { defineUserOperation } from "@/features/auth/server/operation-policies.server";
import { getDb, type DbExecutor } from "@/server/db/index.server";
import { ActionError } from "@/server/operations/action-error";
import { createRateLimiter } from "@/server/rate-limit.server";

const personSchema = z.object({ userId: z.uuid() });
const answerSchema = z.object({ userId: z.uuid(), accept: z.boolean() });

/** Against spam: an hour is enough to add everyone from a few calls. */
const requestLimiter = createRateLimiter({ limit: 20, windowMs: 60 * 60_000 });

const UNAVAILABLE = "Não foi possível agora. Atualize a página.";
const FRIEND_LIMIT = `Limite de ${MAX_FRIENDS} amigos atingido.`;

async function requireOtherAccount(db: DbExecutor, selfId: string, otherId: string) {
  if (selfId === otherId) throw new ActionError("Esse é você.");
  if (!(await isActiveAccount(db, otherId))) throw new ActionError(UNAVAILABLE);
}

/**
 * Asks to be friends. When the other person had already asked, this accepts. A block is
 * answered as an ordinary sent request, so the blocked person never finds out.
 */
export const sendFriendRequest = defineUserOperation(
  { name: "friends.request", audit: "required" },
  personSchema,
  async ({ parsedInput, ctx }) => {
    const requesterId = ctx.current.user.id;
    const targetId = parsedInput.userId;
    if (!requestLimiter.hit(requesterId).ok) {
      throw new ActionError("Muitos pedidos seguidos. Tente de novo mais tarde.");
    }
    const requestOutcome = await getDb().transaction(async (tx) => {
      await requireOtherAccount(tx, requesterId, targetId);
      const outcome = await requestFriendship(tx, requesterId, targetId);
      if (outcome === "friend_limit") throw new ActionError(FRIEND_LIMIT);
      if (outcome === "pending_limit") {
        throw new ActionError("Você tem muitos pedidos sem resposta. Espere alguns serem aceitos.");
      }
      await ctx.audit.record(tx, {
        action: outcome === "accept" ? "friend.accept" : "friend.request",
        resourceType: "user",
        resourceId: targetId,
        metadata: { outcome },
      });
      return outcome;
    });
    nudgeFriendLists(requestNudgeTargets(requesterId, targetId, requestOutcome));
    if (requestOutcome === "accept" || requestOutcome === "already_friends") {
      return { status: "friends" };
    }
    return { status: "sent" };
  },
);

/** Accepts or declines a request received. Declining is silent: the other side is not told. */
export const answerFriendRequest = defineUserOperation(
  { name: "friends.answer", audit: "required" },
  answerSchema,
  async ({ parsedInput, ctx }) => {
    const answererId = ctx.current.user.id;
    const requesterId = parsedInput.userId;
    const result = await getDb().transaction(async (tx) => {
      await lockPeople(tx, answererId, requesterId);
      const existing = await lockFriendship(tx, answererId, requesterId);
      if (!canAnswer(existing, answererId)) throw new ActionError(UNAVAILABLE);
      if (parsedInput.accept) {
        const full =
          (await countFriends(tx, answererId)) >= MAX_FRIENDS ||
          (await countFriends(tx, requesterId)) >= MAX_FRIENDS;
        if (full) throw new ActionError(FRIEND_LIMIT);
        await acceptRequest(tx, answererId, requesterId);
      }
      if (!parsedInput.accept) await dismissRequest(tx, answererId, requesterId);
      await ctx.audit.record(tx, {
        action: parsedInput.accept ? "friend.accept" : "friend.decline",
        resourceType: "user",
        resourceId: requesterId,
      });
      return { status: parsedInput.accept ? "friends" : "declined" };
    });
    // Declining is silent: only the answerer's own tabs reload.
    nudgeFriendLists(parsedInput.accept ? [answererId, requesterId] : [answererId]);
    return result;
  },
);

/** Withdraws a request one sent that is still waiting. */
export const cancelFriendRequest = defineUserOperation(
  { name: "friends.cancel", audit: "required" },
  personSchema,
  async ({ parsedInput, ctx }) => {
    const requesterId = ctx.current.user.id;
    const result = await getDb().transaction(async (tx) => {
      const existing = await lockFriendship(tx, requesterId, parsedInput.userId);
      const ownPending =
        existing?.status === "pending" &&
        existing.requestedBy === requesterId &&
        !existing.privateRequest;
      if (!ownPending || existing.withdrawn) throw new ActionError(UNAVAILABLE);
      // A declined request is kept as a marker: deleting it would let it be sent anew.
      if (existing.dismissed) await withdrawRequest(tx, requesterId, parsedInput.userId);
      if (!existing.dismissed)
        await deleteFriendship(tx, requesterId, parsedInput.userId, "pending");
      await ctx.audit.record(tx, {
        action: "friend.cancel",
        resourceType: "user",
        resourceId: parsedInput.userId,
      });
      return { status: "none" };
    });
    nudgeFriendLists([requesterId, parsedInput.userId]);
    return result;
  },
);

export const removeFriend = defineUserOperation(
  { name: "friends.remove", audit: "required" },
  personSchema,
  async ({ parsedInput, ctx }) => {
    const userId = ctx.current.user.id;
    const result = await getDb().transaction(async (tx) => {
      const removed = await deleteFriendship(tx, userId, parsedInput.userId, "accepted");
      if (!removed) throw new ActionError(UNAVAILABLE);
      await ctx.audit.record(tx, {
        action: "friend.remove",
        resourceType: "user",
        resourceId: parsedInput.userId,
      });
      return { status: "none" };
    });
    nudgeFriendLists([userId, parsedInput.userId]);
    return result;
  },
);

/** Blocks someone: ends the friendship or request and stops new ones, without telling them. */
export const blockUser = defineUserOperation(
  { name: "friends.block", audit: "required" },
  personSchema,
  async ({ parsedInput, ctx }) => {
    const blockerId = ctx.current.user.id;
    const relationEnded = await getDb().transaction(async (tx) => {
      await requireOtherAccount(tx, blockerId, parsedInput.userId);
      const ended = await blockAccount(tx, blockerId, parsedInput.userId);
      await ctx.audit.record(tx, {
        action: "friend.block",
        resourceType: "user",
        resourceId: parsedInput.userId,
      });
      return ended;
    });
    // The blocked person only reloads when something they see went away.
    nudgeFriendLists(relationEnded ? [blockerId, parsedInput.userId] : [blockerId]);
    return { status: "blocked" };
  },
);

export const unblockUser = defineUserOperation(
  { name: "friends.unblock", audit: "required" },
  personSchema,
  async ({ parsedInput, ctx }) => {
    const blockerId = ctx.current.user.id;
    const result = await getDb().transaction(async (tx) => {
      const unblocked = await unblockAccount(tx, blockerId, parsedInput.userId);
      if (!unblocked) throw new ActionError(UNAVAILABLE);
      await ctx.audit.record(tx, {
        action: "friend.unblock",
        resourceType: "user",
        resourceId: parsedInput.userId,
      });
      return { status: "none" };
    });
    nudgeFriendLists([blockerId]);
    return result;
  },
);

/** How I relate to someone, for the "Adicionar amigo" button on their call card. */
export const friendRelation = defineUserOperation(
  { name: "friends.relation", audit: "none" },
  personSchema,
  async ({ parsedInput, ctx }) => ({
    relation: await relationTo(getDb(), ctx.current.user.id, parsedInput.userId),
  }),
);
