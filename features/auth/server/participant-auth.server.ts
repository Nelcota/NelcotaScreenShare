import { eq } from "drizzle-orm";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { isolatedTwoFactor } from "./two-factor-plugin.server";
import { CLIENT_IP_HEADER } from "@/server/client-ip.server";
import { getDb, type Database } from "@/server/db/index.server";
import {
  userAccounts,
  userRateLimits,
  users,
  userSessions,
  userTwoFactors,
  userVerifications,
} from "@/server/db/schema";
import { appUrl, getEnv } from "@/server/env.server";
import { mailLayout } from "@/server/mail.server";
import { deliverAccountMail } from "./auth-mail.server";
import { PASSWORD_LIMITS } from "@/features/auth/domain/password-rules";
import { safeReturnPath } from "@/features/auth/domain/return-path";
import { clearFailuresAfterReset } from "./lockout.server";
import { hashPassword, verifyPassword } from "./password.server";
import { AUTH_RATE_LIMIT_RULES, authHooks, FRESH_SESSION_SECONDS } from "./auth-shared.server";

export const USER_AUTH_BASE_PATH = "/api/auth";

function deliver(to: string, subject: string, content: ReturnType<typeof mailLayout>) {
  return deliverAccountMail({ to, subject, ...content });
}

type MailRecipient = { email: string; name: string };

async function sendResetPasswordMail({ user, url }: { user: MailRecipient; url: string }) {
  await deliver(
    user.email,
    "Redefinir sua senha do Nelcota",
    mailLayout({
      title: "Redefinir senha",
      intro: `Olá, ${user.name}. Recebemos um pedido para redefinir sua senha. Use o botão abaixo para escolher uma nova senha.`,
      notice: "Link válido por 30 minutos · Uso único",
      action: { label: "Definir nova senha", url },
      outro: "Se não foi você, ignore este e-mail: sua senha continua a mesma.",
    }),
  );
}

async function sendExistingAccountMail({ user }: { user: MailRecipient }) {
  await deliver(
    user.email,
    "Alguém tentou criar uma conta com seu e-mail",
    mailLayout({
      title: "Você já tem uma conta no Nelcota",
      intro:
        "Alguém tentou criar uma conta com este e-mail. Se foi você, entre com sua senha ou redefina a senha. Se não foi, ignore este e-mail.",
      action: { label: "Entrar no Nelcota", url: `${appUrl()}/entrar` },
    }),
  );
}

async function sendVerificationMail({ user, url }: { user: MailRecipient; url: string }) {
  await deliver(
    user.email,
    "Confirme seu e-mail no Nelcota",
    mailLayout({
      title: "Confirme seu e-mail",
      intro: `Olá, ${user.name}. Confirme seu e-mail para entrar em salas e compartilhar a tela.`,
      notice: "Link válido por 24 horas",
      action: { label: "Confirmar e-mail", url },
      outro: "Se você não criou uma conta no Nelcota, ignore este e-mail.",
    }),
  );
}

/** `false` vetoes the session; `undefined` lets Better Auth create it. */
async function sessionAllowed(
  db: Database,
  userId: string,
  emailVerification: boolean,
): Promise<false | undefined> {
  const [user] = await db
    .select({
      blockedAt: users.blockedAt,
      deletedAt: users.deletedAt,
      twoFactorEnabled: users.twoFactorEnabled,
    })
    .from(users)
    .where(eq(users.id, userId));
  if (!user || user.blockedAt || user.deletedAt) return false;
  if (emailVerification && user.twoFactorEnabled) return false;
  return undefined;
}

function createUserAuth(db: Database, secret: string) {
  const production = process.env.NODE_ENV === "production";
  const verificationRequired = getEnv().REQUIRE_EMAIL_VERIFICATION;

  return betterAuth({
    appName: "Nelcota",
    baseURL: appUrl(),
    basePath: USER_AUTH_BASE_PATH,
    secret,
    trustedOrigins: [appUrl()],
    telemetry: { enabled: false },
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        users,
        userSessions,
        userAccounts,
        userVerifications,
        userTwoFactors,
        userRateLimits,
      },
    }),
    user: {
      modelName: "users",
      additionalFields: {
        lastSeenAt: { type: "date", required: false, input: false },
        blockedAt: { type: "date", required: false, input: false },
        blockReason: { type: "string", required: false, input: false },
        anonymizedAt: { type: "date", required: false, input: false },
        deletedAt: { type: "date", required: false, input: false },
      },
      // Change e-mail: link sent to the NEW address; takes effect after confirming.
      changeEmail: {
        enabled: true,
        updateEmailWithoutVerification: false,
      },
    },
    account: { modelName: "userAccounts", accountLinking: { enabled: false } },
    verification: { modelName: "userVerifications" },
    session: {
      modelName: "userSessions",
      expiresIn: 30 * 24 * 60 * 60,
      updateAge: 24 * 60 * 60,
      // E-mail changes enforce this window in email-policy.server; other endpoints use passwords.
      freshAge: FRESH_SESSION_SECONDS,
      cookieCache: { enabled: false },
    },
    emailAndPassword: {
      enabled: true,
      // Off for now (REQUIRE_EMAIL_VERIFICATION): sign-up signs the user in right away.
      requireEmailVerification: verificationRequired,
      minPasswordLength: PASSWORD_LIMITS.user.min,
      maxPasswordLength: PASSWORD_LIMITS.user.max,
      password: { hash: hashPassword, verify: verifyPassword },
      resetPasswordTokenExpiresIn: 30 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: sendResetPasswordMail,
      onPasswordReset: ({ user }) =>
        clearFailuresAfterReset(db, { secret, scope: "user", email: user.email }),
      // Sign-up with an existing e-mail: the screen responds the same (no enumeration)
      // and the e-mail owner is notified.
      onExistingUserSignUp: sendExistingAccountMail,
    },
    emailVerification: {
      // With confirmation off, the link is only sent when the person asks (at /conta).
      sendOnSignUp: verificationRequired,
      sendOnSignIn: verificationRequired,
      autoSignInAfterVerification: true,
      expiresIn: 24 * 60 * 60,
      sendVerificationEmail: sendVerificationMail,
      async afterEmailVerification(user, request) {
        if (!("twoFactorEnabled" in user) || user.twoFactorEnabled !== true) return;
        // The address is now verified. Never create a new session from an e-mail link
        // for a 2FA account; an existing authenticated session can continue normally.
        const callback = request ? new URL(request.url).searchParams.get("callbackURL") : null;
        const returnTo = safeReturnPath(callback, "/conta");
        throw new APIError("FOUND", undefined, {
          Location: `/entrar?voltar=${encodeURIComponent(returnTo)}`,
        });
      },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      modelName: "userRateLimits",
      window: 60,
      max: 100,
      customRules: {
        ...AUTH_RATE_LIMIT_RULES,
        "/sign-up/email": { window: 60 * 10, max: 5 },
        "/send-verification-email": { window: 60, max: 2 },
      },
    },
    advanced: {
      cookiePrefix: "nelcota",
      useSecureCookies: production,
      // Lax: e-mail links and room invite links arrive with the session.
      defaultCookieAttributes: { sameSite: "lax", httpOnly: true, path: "/" },
      database: { generateId: false },
      ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] },
    },
    databaseHooks: {
      session: {
        create: {
          // An account blocked by the panel or deleted does not open a session.
          before: (session, context) =>
            sessionAllowed(db, session.userId, context?.path === "/verify-email"),
        },
      },
    },
    hooks: authHooks(db, secret, "user", { audit: false }),
    plugins: [
      isolatedTwoFactor({
        issuer: "Nelcota",
        schema: { twoFactor: { modelName: "userTwoFactors" } },
        backupCodeOptions: { amount: 10, length: 10 },
      }),
    ],
  });
}

export type UserAuth = ReturnType<typeof createUserAuth>;

let instance: UserAuth | undefined;

/** Participant Better Auth instance. */
export function getUserAuth(): UserAuth {
  if (instance) return instance;
  const db = getDb();
  instance = createUserAuth(db, getEnv().AUTH_SECRET);
  return instance;
}

/** Tests only. */
export function createUserAuthForTests(db: Database, secret: string): UserAuth {
  return createUserAuth(db, secret);
}
