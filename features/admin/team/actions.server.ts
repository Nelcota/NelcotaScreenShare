import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { defineAdminOperation } from "@/features/auth/server/operation-policies.server";
import { createAdminInvitation } from "@/features/auth/server/admin-invitations.server";
import { ActionError } from "@/server/operations/action-error";
import { getDb, type DbExecutor } from "@/server/db/index.server";
import { adminInvitations, adminSessions, adminUsers } from "@/server/db/schema";

/**
 * The owner's team screen (/admin/equipe). Every change needs a recent sign-in and is
 * audited; nobody changes their own account here, and owners are never changed here
 * (an owner who lost access is recovered with `create-owner --force`).
 */
const reasonSchema = z
  .string()
  .trim()
  .min(3, "Escreva o motivo.")
  .max(300, "O motivo pode ter até 300 caracteres.");

const memberInput = z.object({ id: z.uuid(), reason: reasonSchema });

async function changeableMember(db: DbExecutor, id: string, actorId: string) {
  if (id === actorId) throw new ActionError("A sua própria conta não muda por aqui.");
  const [member] = await db
    .select({ id: adminUsers.id, role: adminUsers.role, banned: adminUsers.banned })
    .from(adminUsers)
    .where(eq(adminUsers.id, id))
    .for("update");
  if (!member) throw new ActionError("Essa pessoa não está mais na equipe.");
  if (member.role === "owner") throw new ActionError("Donos não mudam por aqui.");
  return member;
}

/** Invites an admin or a reader; the link is only shown now (48 h, single use). */
export const inviteAdminAction = defineAdminOperation(
  {
    name: "adminInvitation.create",
    permission: { adminInvitation: ["create"] },
    fresh: true,
    audit: "required",
  },
  z.object({
    email: z.email("Digite um e-mail válido.").trim().toLowerCase(),
    role: z.enum(["admin", "viewer"]),
  }),
  async ({ parsedInput, ctx }) => {
    const db = getDb();
    const [existing] = await db
      .select({ id: adminUsers.id })
      .from(adminUsers)
      .where(sql`lower(${adminUsers.email}) = ${parsedInput.email}`);
    if (existing) throw new ActionError("Esse e-mail já tem acesso ao painel.");
    const { url, invitation } = await createAdminInvitation(db, {
      email: parsedInput.email,
      role: parsedInput.role,
      invitedBy: ctx.admin.user.id,
    });
    await ctx.audit.record(db, {
      action: "admin_invitation.create",
      resourceType: "admin_invitation",
      resourceId: invitation.id,
      metadata: { papel: parsedInput.role },
    });
    return { link: url };
  },
);

export const revokeAdminInvitationAction = defineAdminOperation(
  {
    name: "adminInvitation.revoke",
    permission: { adminInvitation: ["revoke"] },
    fresh: true,
    audit: "required",
  },
  z.object({ id: z.uuid() }),
  async ({ parsedInput, ctx }) => {
    await getDb().transaction(async (tx) => {
      const [revoked] = await tx
        .update(adminInvitations)
        .set({ status: "revoked" })
        .where(and(eq(adminInvitations.id, parsedInput.id), eq(adminInvitations.status, "pending")))
        .returning({ id: adminInvitations.id });
      if (!revoked) throw new ActionError("Esse convite não está mais pendente.");
      await ctx.audit.record(tx, {
        action: "admin_invitation.revoke",
        resourceType: "admin_invitation",
        resourceId: revoked.id,
      });
    });
    return { revoked: true };
  },
);

/** Takes someone out of the panel now: the account is locked and every session ends. */
export const deactivateAdminAction = defineAdminOperation(
  { name: "admin.deactivate", permission: { user: ["ban"] }, fresh: true, audit: "required" },
  memberInput,
  async ({ parsedInput, ctx }) => {
    const sessions = await getDb().transaction(async (tx) => {
      const member = await changeableMember(tx, parsedInput.id, ctx.admin.user.id);
      if (member.banned) throw new ActionError("Essa conta já está desativada.");
      await tx
        .update(adminUsers)
        .set({ banned: true, banReason: parsedInput.reason })
        .where(eq(adminUsers.id, member.id));
      const ended = await tx
        .delete(adminSessions)
        .where(eq(adminSessions.userId, member.id))
        .returning({ id: adminSessions.id });
      await ctx.audit.record(tx, {
        action: "admin_user.deactivate",
        resourceType: "admin_user",
        resourceId: member.id,
        metadata: { motivo: parsedInput.reason, sessoes: ended.length },
      });
      return ended.length;
    });
    return { sessions };
  },
);

export const reactivateAdminAction = defineAdminOperation(
  { name: "admin.reactivate", permission: { user: ["ban"] }, fresh: true, audit: "required" },
  memberInput,
  async ({ parsedInput, ctx }) => {
    await getDb().transaction(async (tx) => {
      const member = await changeableMember(tx, parsedInput.id, ctx.admin.user.id);
      if (!member.banned) throw new ActionError("Essa conta já está ativa.");
      await tx
        .update(adminUsers)
        .set({ banned: false, banReason: null, banExpires: null })
        .where(eq(adminUsers.id, member.id));
      await ctx.audit.record(tx, {
        action: "admin_user.reactivate",
        resourceType: "admin_user",
        resourceId: member.id,
        metadata: { motivo: parsedInput.reason },
      });
    });
    return { reactivated: true };
  },
);

/** Ends every session of someone on the team: they sign in again (password and 2FA). */
export const endAdminSessionsAction = defineAdminOperation(
  {
    name: "admin.endSessions",
    permission: { session: ["revoke"] },
    fresh: true,
    audit: "required",
  },
  memberInput,
  async ({ parsedInput, ctx }) => {
    const sessions = await getDb().transaction(async (tx) => {
      const member = await changeableMember(tx, parsedInput.id, ctx.admin.user.id);
      const ended = await tx
        .delete(adminSessions)
        .where(eq(adminSessions.userId, member.id))
        .returning({ id: adminSessions.id });
      await ctx.audit.record(tx, {
        action: "admin_user.sessions_revoke",
        resourceType: "admin_user",
        resourceId: member.id,
        metadata: { motivo: parsedInput.reason, sessoes: ended.length },
      });
      return ended.length;
    });
    return { sessions };
  },
);
