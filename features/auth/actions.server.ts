import { z } from "zod";
import { definePublicOperation } from "@/features/auth/server/operation-policies.server";
import { ActionError } from "@/server/operations/action-error";
import { getAdminAuth } from "@/features/auth/server/admin-auth.server";
import { acceptAdminInvitation } from "@/features/auth/server/admin-invitations.server";
import { PASSWORD_LIMITS } from "@/features/auth/domain/password-rules";
import { getDb } from "@/server/db/index.server";
import { logger } from "@/server/logger.server";

const acceptInput = z.object({
  token: z.string().min(20).max(200),
  name: z.string().trim().min(1, "Digite seu nome.").max(80),
  password: z.string().min(PASSWORD_LIMITS.admin.min).max(PASSWORD_LIMITS.admin.max),
});

const REASONS = {
  invalid: "Este convite expirou ou já foi usado. Peça um novo a quem convidou você.",
  already_admin: "Este e-mail já tem acesso ao painel. Entre com sua senha.",
  weak_password: `Use uma senha com ${PASSWORD_LIMITS.admin.min} a ${PASSWORD_LIMITS.admin.max} caracteres.`,
} as const;

/** Accepts the admin invitation and creates the account (no session: public action with rate limit). */
export const acceptInvitation = definePublicOperation(
  { name: "adminInvitation.accept", audit: "required" },
  acceptInput,
  async ({ parsedInput, ctx }) => {
    const db = getDb();
    const auth = getAdminAuth();
    if (!auth) throw new ActionError("O painel admin está desligado neste servidor.");
    // The audit runs inside the acceptance: if it fails, the account is undone and the
    // invitation can be used again, so no admin exists without its record.
    const result = await acceptAdminInvitation(db, auth, parsedInput, {
      onAccepted: (accepted) =>
        ctx.audit.record(
          db,
          {
            action: "admin_invitation.accept",
            resourceType: "admin_invitation",
            resourceId: accepted.invitationId,
            metadata: { papel: accepted.role },
          },
          // Actor: the admin just born from this invitation.
          { adminId: accepted.userId },
        ),
    });
    if (!result.ok) throw new ActionError(REASONS[result.reason]);
    logger.info(
      { event: "admin.invitation_accepted", adminId: result.userId },
      "invitation accepted",
    );
    return { email: result.email };
  },
);
