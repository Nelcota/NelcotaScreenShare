import { and, count, eq, isNull } from "drizzle-orm";
import type { DbExecutor } from "@/server/db/index.server";
import { teams, teamMembers } from "@/server/db/schema/workspaces";
import { ActionError } from "@/server/operations/action-error";
import { lockProSubject } from "@/features/rooms/server/entitlements.server";

/** The pilot's cap on teams one account owns, whether it creates them or is handed one. */
const MAX_OWNED_TEAMS = 3;

/**
 * Refuses a fourth team for this owner. Takes their Pro lock first, so two creations or a
 * creation and a transfer at once cannot both pass the count.
 */
export async function assertMayOwnAnotherTeam(tx: DbExecutor, userId: string, message: string) {
  await lockProSubject(tx, { userId });
  const [used] = await tx
    .select({ total: count() })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(
      and(eq(teamMembers.userId, userId), eq(teamMembers.role, "owner"), isNull(teams.deletedAt)),
    );
  if ((used?.total ?? 0) >= MAX_OWNED_TEAMS) throw new ActionError(message);
}
