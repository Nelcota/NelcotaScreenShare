import { and, lt, or } from "drizzle-orm";
import type { DbExecutor } from "@/server/db/index.server";
import { teamInvitations } from "@/server/db/schema/workspaces";

export async function purgeTeamInvitations(db: DbExecutor, now: Date) {
  const before = new Date(now.getTime() - 30 * 86_400_000);
  await db
    .delete(teamInvitations)
    .where(
      or(
        lt(teamInvitations.expiresAt, before),
        and(lt(teamInvitations.usedAt, before)),
        and(lt(teamInvitations.revokedAt, before)),
      ),
    );
}
