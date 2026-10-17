import { and, count, eq, gt, sql } from "drizzle-orm";
import { isAdminRole, type AdminRole } from "@/features/auth/domain/roles";
import type { DbExecutor } from "@/server/db/index.server";
import { adminInvitations, adminUsers } from "@/server/db/schema";

/**
 * Owner seats in use: every owner account (one locked mid-recovery still holds its seat)
 * plus owner invitations not yet accepted nor expired.
 */
export async function ownerSeatsTaken(db: DbExecutor): Promise<number> {
  const [owners] = await db
    .select({ total: count() })
    .from(adminUsers)
    .where(eq(adminUsers.role, "owner"));
  const [invitations] = await db
    .select({ total: count() })
    .from(adminInvitations)
    .where(
      and(
        eq(adminInvitations.role, "owner"),
        eq(adminInvitations.status, "pending"),
        gt(adminInvitations.expiresAt, sql`now()`),
        sql`not exists (select 1 from ${adminUsers} where lower(${adminUsers.email}) = lower(${adminInvitations.email}))`,
      ),
    );
  return (owners?.total ?? 0) + (invitations?.total ?? 0);
}

/** The panel role tied to an e-mail, or null when it has no panel account. */
export async function panelRoleOfEmail(db: DbExecutor, email: string): Promise<AdminRole | null> {
  const [admin] = await db
    .select({ role: adminUsers.role })
    .from(adminUsers)
    .where(sql`lower(${adminUsers.email}) = ${email.trim().toLowerCase()}`);
  if (!admin) return null;
  if (!isAdminRole(admin.role)) return null;
  return admin.role;
}
