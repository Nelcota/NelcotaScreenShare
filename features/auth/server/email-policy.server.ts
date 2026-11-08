import { APIError, getSessionFromCtx } from "better-auth/api";
import { verifyJWT } from "better-auth/crypto";
import { z } from "zod";
import { safeReturnPath } from "@/features/auth/domain/return-path";
import { requireFreshSession } from "./recent-sign-in-policy.server";

type AuthContext = Parameters<typeof getSessionFromCtx>[0];
const verificationQuery = z.object({ token: z.string(), callbackURL: z.string().optional() });

/** A bearer session alone must not authorize changing the account's recovery address. */
export async function enforceEmailPolicy(ctx: AuthContext, secret: string, freshSeconds: number) {
  if (ctx.path === "/change-email") {
    const current = await getSessionFromCtx(ctx, { disableCookieCache: true });
    if (!current) throw new APIError("UNAUTHORIZED", { code: "UNAUTHORIZED" });
    requireFreshSession(current.session.createdAt, freshSeconds);
    return;
  }
  if (ctx.path !== "/verify-email") return;
  const parsed = verificationQuery.safeParse(ctx.query);
  if (!parsed.success) return;
  const { token, callbackURL } = parsed.data;
  const payload = await verifyJWT<Record<string, unknown>>(token, secret);
  if (!payload || typeof payload.email !== "string") return;
  // Initial confirmation may be needed before sign-in is permitted. It can verify the
  // address, but afterEmailVerification requires a normal sign-in instead of auto-login.
  if (typeof payload.updateTo !== "string") return;
  // The link names only the old address, so it would act on whoever holds it at click
  // time: a later or reclaimed owner. Only the same account, signed in, may redeem it.
  const account = await ctx.context.internalAdapter.findUserByEmail(payload.email);
  if (!account) return;
  const current = await getSessionFromCtx(ctx, { disableCookieCache: true });
  if (current?.user.id === account.user.id) return;

  // Completing sign-in (including 2FA) comes before the verification link can change the address.
  const query = new URLSearchParams({
    token,
    voltar: safeReturnPath(callbackURL, "/conta"),
  });
  throw ctx.redirect(`/verificar-email?${query}`);
}
