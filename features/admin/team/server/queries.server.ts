import { and, asc, desc, eq, gt, max, sql } from "drizzle-orm";
import { isAdminRole, type AdminRole } from "@/features/auth/domain/roles";
import type { DbExecutor } from "@/server/db/index.server";
import { adminInvitations, adminSessions, adminUsers } from "@/server/db/schema";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  twoFactor: boolean;
  active: boolean;
  /** Last use of any session; `null` when none is left. */
  lastSeenAt: Date | null;
}

export interface PendingInvitation {
  id: string;
  email: string;
  role: AdminRole;
  expiresAt: Date;
}

const ROLE_ORDER = sql`case ${adminUsers.role} when 'owner' then 0 when 'admin' then 1 else 2 end`;

/** Everyone with panel access: owners first, then admins and readers, by name. */
export async function listTeam(db: DbExecutor): Promise<TeamMember[]> {
  const rows = await db
    .select({
      id: adminUsers.id,
      name: adminUsers.name,
      email: adminUsers.email,
      role: adminUsers.role,
      twoFactor: adminUsers.twoFactorEnabled,
      banned: adminUsers.banned,
      lastSeenAt: max(adminSessions.updatedAt),
    })
    .from(adminUsers)
    .leftJoin(adminSessions, eq(adminSessions.userId, adminUsers.id))
    .groupBy(adminUsers.id)
    .orderBy(asc(ROLE_ORDER), asc(adminUsers.name));
  return rows.flatMap(({ banned, role, ...row }) =>
    isAdminRole(role) ? [{ ...row, role, active: !banned }] : [],
  );
}

/** Invitations still waiting to be accepted, newest first. */
export async function listPendingInvitations(db: DbExecutor): Promise<PendingInvitation[]> {
  const rows = await db
    .select({
      id: adminInvitations.id,
      email: adminInvitations.email,
      role: adminInvitations.role,
      expiresAt: adminInvitations.expiresAt,
    })
    .from(adminInvitations)
    .where(and(eq(adminInvitations.status, "pending"), gt(adminInvitations.expiresAt, sql`now()`)))
    .orderBy(desc(adminInvitations.createdAt));
  return rows.flatMap(({ role, ...row }) => (isAdminRole(role) ? [{ ...row, role }] : []));
}
