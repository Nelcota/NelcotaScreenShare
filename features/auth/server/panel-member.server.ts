import { and, eq, sql } from "drizzle-orm";
import { getDb, type DbExecutor } from "@/server/db/index.server";
import { adminUsers } from "@/server/db/schema";

/** The app account as far as the panel rule needs it. */
export interface AppAccountForPanel {
  email: string;
  emailVerified: boolean;
}

/**
 * Whether this app account belongs to someone active on the panel's team: its e-mail is
 * verified and equals (ignoring case) the e-mail of a panel account that is not
 * deactivated. Removing someone from the team (Equipe > Desativar) turns this off.
 */
export async function isPanelMember(
  account: AppAccountForPanel | null | undefined,
  db: DbExecutor = getDb(),
): Promise<boolean> {
  if (account == null) return false;
  if (!account.emailVerified) return false;
  const [admin] = await db
    .select({ id: adminUsers.id })
    .from(adminUsers)
    .where(
      and(
        sql`lower(${adminUsers.email}) = ${account.email.trim().toLowerCase()}`,
        eq(adminUsers.banned, false),
      ),
    )
    .limit(1);
  return admin !== undefined;
}
