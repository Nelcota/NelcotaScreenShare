import { and, eq, isNull } from "drizzle-orm";
import type { DbExecutor } from "@/server/db/index.server";
import { teamMembers, teams } from "@/server/db/schema/workspaces";
import { users } from "@/server/db/schema/user-auth";
import { ActionError } from "@/server/operations/action-error";
import { managesTeam } from "@/features/team/domain/team-policy";

export async function workspaceAccount(db: DbExecutor, id: string) {
  const [account] = await db
    .select({ id: users.id, email: users.email, emailVerified: users.emailVerified })
    .from(users)
    .where(and(eq(users.id, id), isNull(users.blockedAt), isNull(users.deletedAt)));
  if (!account) throw new ActionError("Sua conta não pode acessar este espaço.");
  return account;
}
export async function membership(db: DbExecutor, teamId: string, userId: string) {
  const [row] = await db
    .select({ team: teams, role: teamMembers.role })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .innerJoin(users, eq(users.id, teamMembers.userId))
    .where(
      and(
        eq(teamMembers.teamId, teamId),
        eq(teamMembers.userId, userId),
        isNull(teams.deletedAt),
        isNull(users.blockedAt),
        isNull(users.deletedAt),
      ),
    );
  return row;
}
export async function requireMembership(
  db: DbExecutor,
  teamId: string,
  userId: string,
  capability: "read" | "manage" | "owner" = "read",
) {
  const member = await membership(db, teamId, userId);
  if (!member) throw new ActionError("Este time não está disponível para sua conta.");
  if (capability === "manage" && !managesTeam(member.role))
    throw new ActionError("Só donos e gestores podem fazer isso.");
  if (capability === "owner" && member.role !== "owner")
    throw new ActionError("Só o dono pode fazer isso.");
  return member;
}
export async function lockTeam(db: DbExecutor, teamId: string) {
  const [row] = await db
    .select({ id: teams.id })
    .from(teams)
    .where(eq(teams.id, teamId))
    .for("update");
  if (!row) throw new ActionError("Time não encontrado.");
}
