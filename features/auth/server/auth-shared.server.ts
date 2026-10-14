import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { eq } from "drizzle-orm";
import { isPlainWebp, profilePhotoSchema } from "@/features/account/domain/profile-photo";
import { displayNameSchema } from "@/features/room/domain/participant-label";
import { recordAudit } from "@/server/audit.server";
import { clientIpFrom } from "@/server/client-ip.server";
import type { Database } from "@/server/db/index.server";
import { users } from "@/server/db/schema";
import { logger } from "@/server/logger.server";
import { enforceEmailPolicy } from "./email-policy.server";
import { recordAdminLockout } from "./lockout-audit.server";
import { requireSecondFactorEverySignIn } from "./trusted-device.server";
import {
  checkLockout,
  clearFailures,
  emailHash,
  recordFailure,
  type AuthScope,
} from "./lockout.server";

const SIGN_IN_PATH = "/sign-in/email";

/** Critical actions require a recent sign-in: Better Auth (freshAge) and actions use the same window. */
export const FRESH_SESSION_SECONDS = 10 * 60;

/** Per-IP limits shared by the panel and participant accounts (window in seconds). */
export const AUTH_RATE_LIMIT_RULES = {
  [SIGN_IN_PATH]: { window: 60, max: 5 },
  "/request-password-reset": { window: 60, max: 3 },
  "/reset-password": { window: 60, max: 5 },
  "/two-factor/verify-totp": { window: 60, max: 10 },
  "/two-factor/verify-backup-code": { window: 60, max: 5 },
};
/** Sign-in completed by the second factor (TOTP or backup code). */
const TWO_FACTOR_SIGN_IN = new Set(["/two-factor/verify-totp", "/two-factor/verify-backup-code"]);

/**
 * Signed-in routes that check the password: wrong guesses count toward the same account
 * lockout as sign-in, so a stolen session cannot try passwords one IP after another.
 */
const PASSWORD_CHECKS = new Set([
  "/change-password",
  "/two-factor/enable",
  "/two-factor/disable",
  "/two-factor/generate-backup-codes",
  "/two-factor/get-totp-uri",
]);

type AuthContext = Parameters<Parameters<typeof createAuthMiddleware>[0]>[0];

/** The e-mail whose lockout applies: typed at sign-in, the session's on the other routes. */
async function lockoutEmail(ctx: AuthContext): Promise<string | null> {
  if (ctx.path === SIGN_IN_PATH) return stringField(ctx.body, "email") ?? "";
  if (!PASSWORD_CHECKS.has(ctx.path)) return null;
  const session = await getSessionFromCtx(ctx);
  return session?.user.email ?? null;
}

function wrongPassword(returned: unknown, path: string): boolean {
  if (!(returned instanceof APIError)) return false;
  if (path === SIGN_IN_PATH) return returned.statusCode === 401;
  const body: unknown = returned.body;
  return (
    typeof body === "object" && body !== null && Reflect.get(body, "code") === "INVALID_PASSWORD"
  );
}

function lockedMessage(seconds: number): string {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return `Muitas tentativas. Tente de novo em ${minutes} min.`;
}

/** A field of an untyped Better Auth body or query. */
function fieldOf(body: unknown, key: string): unknown {
  if (!body || typeof body !== "object") return undefined;
  const value: unknown = Reflect.get(body, key);
  return value;
}

function stringField(body: unknown, key: string): string | undefined {
  const value = fieldOf(body, key);
  return typeof value === "string" ? value : undefined;
}

function validateProfilePhoto(body: unknown) {
  const image = fieldOf(body, "image");
  if (image === undefined) return;
  const parsed = profilePhotoSchema.safeParse(image);
  if (!parsed.success) throw new APIError("BAD_REQUEST", { message: "Foto de perfil inválida." });
  if (parsed.data === null) return;
  const bytes = Buffer.from(parsed.data.split(",")[1] ?? "", "base64");
  if (!isPlainWebp(bytes)) {
    throw new APIError("BAD_REQUEST", { message: "Foto de perfil inválida." });
  }
}

async function validatePasswordReset(
  db: Database,
  token: string | undefined,
  findVerification: (identifier: string) => Promise<{ value: string } | null>,
) {
  if (!token) return;
  const verification = await findVerification(`reset-password:${token}`);
  if (!verification) return;
  const [user] = await db
    .select({ deletedAt: users.deletedAt, anonymizedAt: users.anonymizedAt })
    .from(users)
    .where(eq(users.id, verification.value));
  if (!user || user.deletedAt || user.anonymizedAt) {
    throw new APIError("BAD_REQUEST", {
      code: "INVALID_TOKEN",
      message: "Link de recuperação inválido.",
    });
  }
}

/**
 * A wrong password counts toward the lockout. In the panel, the failure that starts a
 * lockout is audited once (only for a real admin); the others stay in `login_failures`.
 */
async function countWrongPassword(
  db: Database,
  {
    scope,
    hash,
    email,
    ip,
    audit,
  }: { scope: AuthScope; hash: string; email: string; ip?: string; audit: boolean },
) {
  await recordFailure(db, { scope, hash, ip });
  logger.warn({ event: `${scope}.sign_in_failed` }, "sign-in refused");
  if (!audit) return;
  const status = await checkLockout(db, { scope, hash, ip });
  if (!status.locked) return;
  await safeAudit(() =>
    recordAdminLockout(db, { email, hash, retryAfterSeconds: status.retryAfterSeconds }),
  );
}

/** Auditing never breaks sign-in: a failure becomes a log entry. */
async function safeAudit(audit: () => Promise<void>) {
  try {
    await audit();
  } catch (error) {
    logger.error({ err: error }, "failed to write authentication audit");
  }
}

/** A wrong password on a signed-in route counts toward the session account's lockout. */
async function countWrongPasswordSignedIn(
  ctx: AuthContext,
  { db, secret, scope, audit }: { db: Database; secret: string; scope: AuthScope; audit: boolean },
) {
  if (!PASSWORD_CHECKS.has(ctx.path) || !wrongPassword(ctx.context.returned, ctx.path)) return;
  const email = await lockoutEmail(ctx);
  if (!email) return;
  const ip = ctx.headers ? clientIpFrom(ctx.headers) : undefined;
  await countWrongPassword(db, { scope, hash: emailHash(secret, scope, email), email, ip, audit });
}

/**
 * The account name goes through the same rules as the screens (1 to 32 characters, no
 * invisible ones), so a direct call cannot store a disguised name or hit the database check.
 */
function cleanName(body: unknown) {
  if (typeof body !== "object" || body === null || !Reflect.has(body, "name")) return;
  const parsed = displayNameSchema.safeParse(Reflect.get(body, "name"));
  if (!parsed.success) {
    throw new APIError("BAD_REQUEST", {
      code: "INVALID_NAME",
      message: parsed.error.issues[0]?.message ?? "Confira o nome.",
    });
  }
  Reflect.set(body, "name", parsed.data);
}

/**
 * Better Auth hooks: lockout after wrong passwords (admins and participants,
 * separated by `scope`) and, in the admin panel, auditing of sign-in events.
 */
export function authHooks(
  db: Database,
  secret: string,
  scope: AuthScope,
  { audit }: { audit: boolean },
) {
  return {
    before: createAuthMiddleware(async (ctx) => {
      if (scope === "admin") await requireSecondFactorEverySignIn(db, ctx.path, ctx.body);
      if (scope === "user") {
        await enforceEmailPolicy(ctx, secret, FRESH_SESSION_SECONDS);
        if (ctx.path === "/update-user" || ctx.path === "/sign-up/email") {
          validateProfilePhoto(ctx.body);
          cleanName(ctx.body);
        }
        if (ctx.path === "/reset-password") {
          await validatePasswordReset(
            db,
            stringField(ctx.body, "token") || stringField(ctx.query, "token"),
            (identifier) => ctx.context.internalAdapter.findVerificationValue(identifier),
          );
        }
      }
      const email = await lockoutEmail(ctx);
      if (email === null) return;
      const hash = emailHash(secret, scope, email);
      const status = await checkLockout(db, {
        scope,
        hash,
        ip: ctx.headers ? clientIpFrom(ctx.headers) : undefined,
      });
      if (status.locked) {
        // Attempts while locked only reach the log: the lockout itself was audited once.
        logger.warn({ event: `${scope}.sign_in_locked` }, "sign-in while locked");
        throw new APIError("TOO_MANY_REQUESTS", {
          code: "SIGN_IN_LOCKED",
          message: lockedMessage(status.retryAfterSeconds),
        });
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      const returned = ctx.context.returned;
      const failed = returned instanceof APIError;

      if (audit && !failed && TWO_FACTOR_SIGN_IN.has(ctx.path)) {
        const userId = ctx.context.newSession?.user.id;
        if (userId) {
          await safeAudit(() =>
            recordAudit(
              db,
              { adminId: userId },
              {
                action: "auth.sign_in",
                resourceType: "admin_user",
                resourceId: userId,
                metadata: { segundo_fator: ctx.path.endsWith("backup-code") ? "backup" : "totp" },
              },
            ),
          );
        }
        return;
      }

      if (ctx.path !== SIGN_IN_PATH) {
        return countWrongPasswordSignedIn(ctx, { db, secret, scope, audit });
      }
      const hash = emailHash(secret, scope, stringField(ctx.body, "email") ?? "");
      if (failed) {
        if (returned.statusCode !== 401) return;
        await countWrongPassword(db, {
          scope,
          hash,
          email: stringField(ctx.body, "email") ?? "",
          ip: ctx.headers ? clientIpFrom(ctx.headers) : undefined,
          audit,
        });
        return;
      }
      await clearFailures(db, { scope, hash });
      // Without 2FA, the session is born here; with 2FA, in verify (above).
      const userId = ctx.context.newSession?.user.id;
      if (audit && userId) {
        await safeAudit(() =>
          recordAudit(
            db,
            { adminId: userId },
            { action: "auth.sign_in", resourceType: "admin_user", resourceId: userId },
          ),
        );
      }
    }),
  };
}
