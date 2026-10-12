import { and, asc, eq, isNull, or, ilike } from "drizzle-orm";
import type { DbExecutor } from "@/server/db/index.server";
import { users } from "@/server/db/schema/user-auth";
import { teams, proEntitlements } from "@/server/db/schema/workspaces";

export async function betaSubjects(db: DbExecutor, query = "") {
  const search = query
    .trim()
    .slice(0, 100)
    .replaceAll(/[%_\\]/g, "\\$&");
  const accounts = await db
    .select({ id: users.id, name: users.name, email: users.email, pro: proEntitlements })
    .from(users)
    .leftJoin(proEntitlements, eq(proEntitlements.userId, users.id))
    .where(
      and(
        isNull(users.deletedAt),
        isNull(users.blockedAt),
        search
          ? or(ilike(users.name, `%${search}%`), ilike(users.email, `%${search}%`))
          : undefined,
      ),
    )
    .orderBy(asc(users.name))
    .limit(100);
  const teamList = await db
    .select({ id: teams.id, name: teams.name, pro: proEntitlements })
    .from(teams)
    .leftJoin(proEntitlements, eq(proEntitlements.teamId, teams.id))
    .where(and(isNull(teams.deletedAt), search ? ilike(teams.name, `%${search}%`) : undefined))
    .orderBy(asc(teams.name))
    .limit(100);
  return { accounts, teams: teamList };
}
