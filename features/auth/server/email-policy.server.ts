import { APIError, getSessionFromCtx } from "better-auth/api";
import { verifyJWT } from "better-auth/crypto";
import { z } from "zod";
import { safeReturnPath } from "@/features/auth/domain/return-path";

type AuthContext = Parameters<typeof getSessionFromCtx>[0];
const verificationQuery = z.object({ token: z.string(), callbackURL: z.string().optional() });

/** A bearer session alone must not authorize changing the account's recovery address. */
export async function enforceEmailPolicy(ctx: AuthContext, secret: string, freshSeconds: number) {
  if (ctx.path === "/change-email") {
    const current = await getSessionFromCtx(ctx, { disableCookieCache: true });
    if (!current) throw new APIError("UNAUTHORIZED", { code: "UNAUTHORIZED" });
    const age = Date.now() - new Date(current.session.createdAt).getTime();
    if (age >= freshSeconds * 1000) {
      throw new APIError("FORBIDDEN", { code: "SESSION_NOT_FRESH" });
    }
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
  const account = await ctx.context.internalAdapter.findUserByEmail(payload.email);
  if (!account || !("twoFactorEnabled" in account.user) || account.user.twoFactorEnabled !== true) {
    return;
  }
  const current = await getSessionFromCtx(ctx, { disableCookieCache: true });
  if (current?.user.id === account.user.id) return;

  // Completing sign-in (including 2FA) comes before the verification link can create a session.
  const query = new URLSearchParams({
    token,
    voltar: safeReturnPath(callbackURL, "/conta"),
  });
  throw ctx.redirect(`/verificar-email?${query}`);
}
