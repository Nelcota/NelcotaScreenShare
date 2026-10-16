import { and, eq, isNull } from "drizzle-orm";
import type { DbExecutor } from "@/server/db/index.server";
import { teamInvitations, teamMembers } from "@/server/db/schema/workspaces";
import { ActionError } from "@/server/operations/action-error";
import { requireMembership, workspaceAccount } from "./access.server";
import { revokeTeamSessions } from "./session-revocation.server";
import { assertMayOwnAnotherTeam } from "./team-allowance.server";

async function targetMember(tx: DbExecutor, teamId: string, userId: string) {
  const [member] = await tx
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));
  if (!member) throw new ActionError("Esta pessoa não pertence ao time.");
  return member;
}
export async function changeMemberRole(
  tx: DbExecutor,
  teamId: string,
  actor: string,
  userId: string,
  role: "manager" | "member",
) {
  await requireMembership(tx, teamId, actor, "owner");
  const target = await targetMember(tx, teamId, userId);
  if (target.role === "owner")
    throw new ActionError("Transfira a propriedade antes de mudar a função do dono.");
  await tx
    .update(teamMembers)
    .set({ role })
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));
  if (role === "member") await revokeCreatedInvitations(tx, teamId, userId);
}
export async function transferTeam(tx: DbExecutor, teamId: string, actor: string, userId: string) {
  await requireMembership(tx, teamId, actor, "owner");
  if (actor === userId) throw new ActionError("Escolha outra pessoa para assumir o time.");
  await targetMember(tx, teamId, userId);
  await workspaceAccount(tx, userId);
  await assertMayOwnAnotherTeam(
    tx,
    userId,
    "Essa pessoa já é dona de 3 times: o piloto permite até 3 times por conta.",
  );
  await tx
    .update(teamMembers)
    .set({ role: "manager" })
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, actor)));
  await tx
    .update(teamMembers)
    .set({ role: "owner" })
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));
}
export async function removeTeamMember(
  tx: DbExecutor,
  teamId: string,
  actor: string,
  userId: string,
) {
  const target = await targetMember(tx, teamId, userId);
  if (target.role === "owner")
    throw new ActionError("O dono precisa transferir a propriedade ou excluir o time.");
  // Managers remove members; removing a manager is the owner's, like changing roles.
  if (actor !== userId)
    await requireMembership(tx, teamId, actor, target.role === "manager" ? "owner" : "manage");
  await tx
    .delete(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));
  await revokeCreatedInvitations(tx, teamId, userId);
  return revokeTeamSessions(tx, teamId, userId);
}
async function revokeCreatedInvitations(tx: DbExecutor, teamId: string, actor: string) {
  await tx
    .update(teamInvitations)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(teamInvitations.teamId, teamId),
        eq(teamInvitations.createdBy, actor),
        isNull(teamInvitations.usedAt),
        isNull(teamInvitations.revokedAt),
      ),
    );
}
