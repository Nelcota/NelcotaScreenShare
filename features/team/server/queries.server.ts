import { and, asc, desc, eq, isNull } from "drizzle-orm";
import type { DbExecutor } from "@/server/db/index.server";
import { teams, teamMembers, teamInvitations } from "@/server/db/schema/workspaces";
import { users } from "@/server/db/schema/user-auth";
import { managesTeam } from "@/features/team/domain/team-policy";
import { requireMembership, workspaceAccount } from "./access.server";
import { workspaceRooms } from "@/features/rooms/server/queries.server";
import { entitlement } from "@/features/rooms/server/entitlements.server";

export async function myTeams(db: DbExecutor, actor: string) {
  await workspaceAccount(db, actor);
  return db
    .select({ id: teams.id, name: teams.name, role: teamMembers.role })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(and(eq(teamMembers.userId, actor), isNull(teams.deletedAt)))
    .orderBy(asc(teams.name))
    .limit(100);
}
export async function teamWorkspace(db: DbExecutor, teamId: string, actor: string) {
  const current = await requireMembership(db, teamId, actor);
  const members = await db
    .select({ id: users.id, name: users.name, role: teamMembers.role })
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.userId))
    .where(and(eq(teamMembers.teamId, teamId), isNull(users.deletedAt), isNull(users.blockedAt)))
    .orderBy(asc(teamMembers.createdAt))
    .limit(200);
  const invitations = managesTeam(current.role)
    ? await db
        .select({
          id: teamInvitations.id,
          email: teamInvitations.email,
          role: teamInvitations.role,
          expiresAt: teamInvitations.expiresAt,
          usedAt: teamInvitations.usedAt,
          revokedAt: teamInvitations.revokedAt,
        })
        .from(teamInvitations)
        .where(eq(teamInvitations.teamId, teamId))
        .orderBy(desc(teamInvitations.createdAt))
        .limit(100)
    : [];
  return {
    team: current.team,
    role: current.role,
    members,
    invitations,
    rooms: await workspaceRooms(db, actor, teamId),
    pro: await entitlement(db, { teamId }),
  };
}
