import { APIError, getSessionFromCtx } from "better-auth/api";
import type { AuthScope } from "./lockout.server";

type AuthContext = Parameters<typeof getSessionFromCtx>[0];

/**
 * Routes Better Auth guards with the password alone. Each one either reissues a fresh
 * session or hands out sign-in material (backup codes), so on an account with a second
 * factor a stolen session plus the password would become a full sign-in.
 */
const SECOND_FACTOR_CHANGES = new Set([
  "/change-password",
  "/two-factor/enable",
  "/two-factor/disable",
  "/two-factor/generate-backup-codes",
]);

/** Returns the stored authenticator secret; the screens never read it back after setup. */
const TOTP_SECRET_PATH = "/two-factor/get-totp-uri";

function hasSecondFactor(user: object): boolean {
  return "twoFactorEnabled" in user && user.twoFactorEnabled === true;
}

/**
 * Throws SESSION_NOT_FRESH unless the session started within `freshSeconds`.
 *
 * @throws {APIError} FORBIDDEN with code SESSION_NOT_FRESH when the session is older.
 */
export function requireFreshSession(createdAt: Date | string, freshSeconds: number) {
  const age = Date.now() - new Date(createdAt).getTime();
  if (age < freshSeconds * 1000) return;
  throw new APIError("FORBIDDEN", { code: "SESSION_NOT_FRESH" });
}

/**
 * Password and second-factor changes need a sign-in completed in the last `freshSeconds`
 * on accounts with a second factor (every admin, participants who turned it on), and the
 * authenticator secret is never read back.
 *
 * @throws {APIError} NOT_FOUND for the authenticator secret route.
 * @throws {APIError} FORBIDDEN with code SESSION_NOT_FRESH on an older session.
 */
export async function enforceRecentSignIn(
  ctx: AuthContext,
  scope: AuthScope,
  freshSeconds: number,
) {
  if (ctx.path === TOTP_SECRET_PATH) throw new APIError("NOT_FOUND");
  if (!SECOND_FACTOR_CHANGES.has(ctx.path)) return;
  const current = await getSessionFromCtx(ctx, { disableCookieCache: true });
  // No session: Better Auth answers 401 on its own.
  if (!current) return;
  if (scope === "user" && !hasSecondFactor(current.user)) return;
  requireFreshSession(current.session.createdAt, freshSeconds);
}
