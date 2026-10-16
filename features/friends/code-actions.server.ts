import { z } from "zod";
import { defineUserOperation } from "@/features/auth/server/operation-policies.server";
import {
  formatFriendCode,
  looksLikeEmail,
  parseFriendCode,
} from "@/features/friends/domain/friend-code";
import { friendLinkPath } from "@/features/friends/domain/friend-link";
import {
  MAX_FRIENDS,
  MAX_PENDING_SENT,
  type FriendRequestOutcome,
} from "@/features/friends/domain/friendship";
import {
  accountByEmail,
  ownerOfFriendCode,
  rotateFriendCode,
} from "@/features/friends/server/friend-codes.server";
import { rotateFriendLink } from "@/features/friends/server/friend-links.server";
import { countFriends, countPendingSent } from "@/features/friends/server/friendships.server";
import { requestFriendship } from "@/features/friends/server/request-friendship.server";
import { nudgeFriendLists } from "@/features/friends/server/friend-nudges.server";
import { requestNudgeTargets } from "@/features/friends/domain/friend-nudges";
import { getDb, type DbExecutor } from "@/server/db/index.server";
import { ActionError } from "@/server/operations/action-error";
import { clientIpFrom } from "@/server/client-ip.server";
import { createRateLimiter } from "@/server/rate-limit.server";
import { requestHeaders } from "@/server/request-context.server";

const addSchema = z.object({ target: z.string().trim().min(1).max(254) });
const emailSchema = z.email();

/** Counts every try, found or not, so nobody can test e-mails or codes one after another. */
const attemptLimiter = createRateLimiter({ limit: 10, windowMs: 15 * 60_000 });
/** The same per network: several accounts from one place do not add up to more guesses. */
const ipAttemptLimiter = createRateLimiter({ limit: 30, windowMs: 15 * 60_000 });

const TOO_MANY_TRIES = "Muitas tentativas. Espere alguns minutos.";

const BAD_EMAIL = "Confira o e-mail.";
const BAD_CODE = "Confira o código. Ele é assim: NELC-4K7Q2X.";
const UNKNOWN_CODE = "Nenhuma conta com esse código.";
const TOO_MANY_PENDING = "Você tem muitos pedidos sem resposta. Espere alguns serem aceitos.";

type Target = { via: "email"; id: string | null } | { via: "code"; id: string | null };

/** Whose account the typed e-mail or code points to; the shape is checked first. */
async function resolveTarget(db: DbExecutor, input: string): Promise<Target> {
  if (looksLikeEmail(input)) {
    const email = emailSchema.safeParse(input);
    if (!email.success) throw new ActionError(BAD_EMAIL);
    return { via: "email", id: await accountByEmail(db, email.data) };
  }
  const code = parseFriendCode(input);
  if (!code) throw new ActionError(BAD_CODE);
  return { via: "code", id: await ownerOfFriendCode(db, code) };
}

/**
 * What the person sees. Limits about the target ("their list is full") would tell that the
 * account exists, so they read as an ordinary sent request.
 */
async function statusFor(
  db: DbExecutor,
  requesterId: string,
  outcome: FriendRequestOutcome,
): Promise<"sent" | "friends"> {
  if (outcome === "pending_limit") throw new ActionError(TOO_MANY_PENDING);
  if (outcome === "friend_limit" && (await countFriends(db, requesterId)) >= MAX_FRIENDS) {
    throw new ActionError(`Limite de ${MAX_FRIENDS} amigos atingido.`);
  }
  if (outcome === "accept" || outcome === "already_friends") return "friends";
  return "sent";
}

/**
 * Asks someone to be friends by e-mail or friend code. By e-mail the answer is always
 * "sent", whether the account exists or not, so the field cannot reveal who has an account.
 */
export const addFriend = defineUserOperation(
  { name: "friends.add", audit: "required" },
  addSchema,
  async ({ parsedInput, ctx }) => {
    const requesterId = ctx.current.user.id;
    if (!attemptLimiter.hit(requesterId).ok) throw new ActionError(TOO_MANY_TRIES);
    const ip = clientIpFrom(requestHeaders());
    if (ip && !ipAttemptLimiter.hit(ip).ok) throw new ActionError(TOO_MANY_TRIES);
    const db = getDb();
    // Before looking the account up: otherwise only an existing e-mail would hit the limit.
    if ((await countPendingSent(db, requesterId)) >= MAX_PENDING_SENT) {
      throw new ActionError(TOO_MANY_PENDING);
    }
    const target = await resolveTarget(db, parsedInput.target);
    if (target.id === requesterId) throw new ActionError("Esse é você.");
    if (!target.id && target.via === "code") throw new ActionError(UNKNOWN_CODE);
    const result = await db.transaction(async (tx) => {
      const outcome = target.id
        ? await requestFriendship(tx, requesterId, target.id, target.via === "email")
        : "ignored";
      await ctx.audit.record(tx, {
        action: outcome === "accept" ? "friend.accept" : "friend.request",
        resourceType: "user",
        resourceId: target.id,
        metadata: { outcome, via: target.via },
      });
      const privatePending =
        target.via === "email" && outcome !== "accept" && outcome !== "already_friends";
      return {
        outcome,
        status: privatePending ? ("sent" as const) : await statusFor(tx, requesterId, outcome),
      };
    });
    nudgeFriendLists(requestNudgeTargets(requesterId, target.id ?? undefined, result.outcome));
    return { status: result.status };
  },
);

/** A new code and a new link: whoever has the old ones can no longer use them. */
export const newFriendCode = defineUserOperation(
  { name: "friends.newCode", audit: "required" },
  z.undefined(),
  async ({ ctx }) => {
    const userId = ctx.current.user.id;
    return getDb().transaction(async (tx) => {
      const code = await rotateFriendCode(tx, userId);
      const token = await rotateFriendLink(tx, userId);
      await ctx.audit.record(tx, {
        action: "friend.code_rotate",
        resourceType: "user",
        resourceId: userId,
      });
      return { code: formatFriendCode(code), path: friendLinkPath(token) };
    });
  },
);
