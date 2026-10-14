import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { defineUserOperation } from "@/features/auth/server/operation-policies.server";
import { ActionError } from "@/server/operations/action-error";
import { verifyPassword } from "@/features/auth/server/password.server";
import { getDb } from "@/server/db/index.server";
import { userAccounts, userSessions } from "@/server/db/schema";
import { logger } from "@/server/logger.server";
import { anonymizeParticipant } from "@/features/account/server/participant-accounts.server";
import { secondFactorMatches } from "@/features/account/server/second-factor.server";
import { createRateLimiter } from "@/server/rate-limit.server";

/** Wrong password when deleting the account: few attempts per account, against guessing. */
const deletePasswordFailures = createRateLimiter({ limit: 5, windowMs: 15 * 60_000 });

/** With two-step verification on, the password alone does not delete the account. */
async function requireSecondFactor(enabled: boolean, code: string | undefined, userId: string) {
  if (!enabled) return;
  if (!code) throw new ActionError("Digite o código de duas etapas para confirmar.");
  if (await secondFactorMatches(code)) return;
  deletePasswordFailures.hit(userId);
  throw new ActionError("Código inválido. Confira e tente de novo.");
}

/** Ends a session of the user's own account (the token never goes to the browser). */
export const revokeMySession = defineUserOperation(
  { name: "account.revokeSession", audit: "none", allowUnverified: true },
  z.object({ sessionId: z.uuid() }),
  async ({ parsedInput, ctx }) => {
    if (parsedInput.sessionId === ctx.current.session.id) {
      throw new ActionError("Para sair deste dispositivo, use o botão Sair.");
    }
    const deleted = await getDb()
      .delete(userSessions)
      .where(
        and(
          eq(userSessions.id, parsedInput.sessionId),
          eq(userSessions.userId, ctx.current.user.id),
        ),
      )
      .returning({ id: userSessions.id });
    if (deleted.length === 0) throw new ActionError("Sessão não encontrada. Atualize a página.");
    return { revoked: true };
  },
);

export const revokeMyOtherSessions = defineUserOperation(
  { name: "account.revokeOtherSessions", audit: "none", allowUnverified: true },
  z.undefined(),
  async ({ ctx }) => {
    const deleted = await getDb()
      .delete(userSessions)
      .where(
        and(
          eq(userSessions.userId, ctx.current.user.id),
          ne(userSessions.id, ctx.current.session.id),
        ),
      )
      .returning({ id: userSessions.id });
    return { revoked: deleted.length };
  },
);

/**
 * Account deletion (LGPD): anonymizes instead of deleting the row, to keep only
 * the access records required by law for the legal period. E-mail, name,
 * password, 2FA and sessions are removed immediately. Requires the current password.
 */
export const deleteMyAccount = defineUserOperation(
  { name: "account.delete", audit: "required", allowUnverified: true },
  z.object({
    password: z.string().min(1).max(128),
    /** With two-step verification on: the app's code or a backup code. */
    code: z.string().trim().max(32).optional(),
    deleteOwnedTeams: z.boolean().default(false),
  }),
  async ({ parsedInput, ctx }) => {
    const db = getDb();
    const userId = ctx.current.user.id;
    if (!deletePasswordFailures.peek(userId).ok) {
      throw new ActionError("Muitas tentativas com a senha errada. Aguarde alguns minutos.");
    }
    const [credential] = await db
      .select({ password: userAccounts.password })
      .from(userAccounts)
      .where(and(eq(userAccounts.userId, userId), eq(userAccounts.providerId, "credential")));
    if (
      !credential?.password ||
      !(await verifyPassword({ hash: credential.password, password: parsedInput.password }))
    ) {
      deletePasswordFailures.hit(userId);
      throw new ActionError("Senha incorreta.");
    }
    await requireSecondFactor(ctx.current.user.twoFactorEnabled, parsedInput.code, userId);
    deletePasswordFailures.reset(userId);
    await db.transaction(async (tx) => {
      await anonymizeParticipant(tx, userId, parsedInput.deleteOwnedTeams);
      // LGPD: record of the deletion requested by the data subject (no personal data).
      await ctx.audit.record(tx, {
        action: "user.self_delete",
        resourceType: "user",
        resourceId: userId,
      });
    });
    logger.info({ event: "user.account_deleted", userId }, "account deleted by its owner");
    return { deleted: true };
  },
);
