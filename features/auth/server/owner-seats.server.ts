import { sql } from "drizzle-orm";
import { isAdminRole, type AdminRole } from "@/features/auth/domain/roles";
import type { DbExecutor } from "@/server/db/index.server";
import { adminInvitations, adminUsers } from "@/server/db/schema";

/**
 * Owner seats in use: every owner account (one locked mid-recovery still holds its seat)
 * plus pending invitations and invitations whose account creation is still in progress.
 */
export async function ownerSeatsTaken(db: DbExecutor): Promise<number> {
  // One snapshot avoids losing a seat while invitation acceptance creates its account.
  const result = await db.execute<{ total: number }>(sql`
    select count(distinct email)::int as total from (
      select lower(${adminUsers.email}) as email from ${adminUsers}
      where ${adminUsers.role} = 'owner'
      union all
      select lower(${adminInvitations.email}) as email from ${adminInvitations}
      where ${adminInvitations.role} = 'owner'
        and (
          (${adminInvitations.status} = 'pending' and ${adminInvitations.expiresAt} > now())
          or (${adminInvitations.status} = 'accepted' and ${adminInvitations.acceptedUserId} is null)
        )
        and not exists (
          select 1 from ${adminUsers}
          where lower(${adminUsers.email}) = lower(${adminInvitations.email})
        )
    ) as seats
  `);
  return result.rows[0]?.total ?? 0;
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
