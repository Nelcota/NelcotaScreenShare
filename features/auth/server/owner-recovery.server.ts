import { eq, sql } from "drizzle-orm";
import { recordAudit } from "@/server/audit.server";
import type { DbExecutor } from "@/server/db/index.server";
import { adminSessions, adminTwoFactors, adminUsers } from "@/server/db/schema";
import { OWNER_RECOVERY_REASON } from "@/features/auth/domain/owner-recovery";
import { createAdminInvitation, OWNER_BOOTSTRAP_TTL_MS } from "./admin-invitations.server";

async function adminByEmail(db: DbExecutor, email: string) {
  const [admin] = await db
    .select({ id: adminUsers.id })
    .from(adminUsers)
    .where(sql`lower(${adminUsers.email}) = ${email.trim().toLowerCase()}`);
  return admin;
}

/**
 * `create-owner --force` for an e-mail that already has panel access (an owner who lost
 * their 2FA and backup codes): the account is locked, its sessions end and its 2FA is
 * removed, then an owner invitation for the same e-mail is issued. Accepting it brings the
 * same account back with a new password, and the panel asks to set 2FA up again.
 * `null` when the e-mail has no panel account (a regular invitation is enough).
 */
export async function startOwnerRecovery(db: DbExecutor, email: string) {
  const admin = await adminByEmail(db, email);
  if (!admin) return null;
  await db.transaction(async (tx) => {
    await tx
      .update(adminUsers)
      .set({ banned: true, banReason: OWNER_RECOVERY_REASON, twoFactorEnabled: false })
      .where(eq(adminUsers.id, admin.id));
    await tx.delete(adminSessions).where(eq(adminSessions.userId, admin.id));
    await tx.delete(adminTwoFactors).where(eq(adminTwoFactors.userId, admin.id));
    await recordAudit(tx, "system", {
      action: "admin.recovery_start",
      resourceType: "admin_user",
      resourceId: admin.id,
    });
  });
  return createAdminInvitation(db, {
    email,
    role: "owner",
    invitedBy: null,
    ttlMs: OWNER_BOOTSTRAP_TTL_MS,
  });
}
