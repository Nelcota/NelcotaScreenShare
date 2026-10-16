import { getEnv } from "@/server/env.server";
import { and, eq, isNull } from "drizzle-orm";
import type { Database, DbExecutor } from "@/server/db/index.server";
import { teams, teamMembers, teamInvitations } from "@/server/db/schema/workspaces";
import type { AuditRecorder } from "@/server/audit.server";
import { ActionError } from "@/server/operations/action-error";
import type { TeamCommand } from "@/features/team/domain/commands";
import { applyRoomCommand } from "@/features/room/server/control-commands.server";
import { requireEntitlement } from "@/features/rooms/server/entitlements.server";
import { lockTeam, requireMembership, workspaceAccount } from "./access.server";
import { assertMayOwnAnotherTeam } from "./team-allowance.server";
import {
  acceptTeamInvitation,
  createTeamInvitation,
  revokeTeamInvitation,
} from "./invitations.server";
import { changeMemberRole, removeTeamMember, transferTeam } from "./member-mutations.server";
import { archiveTeamRooms } from "./session-revocation.server";

interface Outcome {
  teamId: string;
  commandIds?: string[];
  invitationLink?: string;
  resourceId?: string;
  deleted?: boolean;
  left?: boolean;
}
async function createTeam(tx: DbExecutor, actor: string, name: string): Promise<Outcome> {
  if (!getEnv().ROOM_HOST_CONTROLS_ENABLED)
    throw new ActionError("Times estão indisponíveis nesta instância.");
  await assertMayOwnAnotherTeam(tx, actor, "O piloto permite até 3 times por conta.");
  await requireEntitlement(tx, { userId: actor });
  const [team] = await tx.insert(teams).values({ name }).returning({ id: teams.id });
  if (!team) throw new Error("Team was not saved");
  await tx.insert(teamMembers).values({ teamId: team.id, userId: actor, role: "owner" });
  return { teamId: team.id };
}
async function changeTeam(
  tx: DbExecutor,
  actor: string,
  input: Exclude<TeamCommand, { kind: "accept" | "create" }>,
): Promise<Outcome> {
  await lockTeam(tx, input.teamId);
  const required =
    input.kind === "role" || input.kind === "transfer" || input.kind === "delete"
      ? "owner"
      : "manage";
  await requireMembership(
    tx,
    input.teamId,
    actor,
    input.kind === "remove" && input.userId === actor ? "read" : required,
  );
  if (input.kind === "invite") {
    // Who manages the team is the owner's call: a manager brings in members only.
    if (input.role === "manager") await requireMembership(tx, input.teamId, actor, "owner");
    const invitation = await createTeamInvitation(tx, input.teamId, actor, input.email, input.role);
    return {
      teamId: input.teamId,
      invitationLink: invitation.invitationLink,
      resourceId: invitation.invitationId,
    };
  }
  if (input.kind === "rename")
    await tx.update(teams).set({ name: input.name }).where(eq(teams.id, input.teamId));
  if (input.kind === "revoke") {
    await revokeTeamInvitation(tx, input.teamId, input.invitationId);
    return { teamId: input.teamId, resourceId: input.invitationId };
  }
  if (input.kind === "role")
    await changeMemberRole(tx, input.teamId, actor, input.userId, input.role);
  if (input.kind === "transfer") await transferTeam(tx, input.teamId, actor, input.userId);
  if (input.kind === "remove")
    return {
      teamId: input.teamId,
      commandIds: await removeTeamMember(tx, input.teamId, actor, input.userId),
      left: input.userId === actor,
    };
  if (input.kind === "delete")
    return { teamId: input.teamId, commandIds: await deleteTeam(tx, input.teamId), deleted: true };
  return { teamId: input.teamId };
}
export async function deleteTeam(tx: DbExecutor, teamId: string) {
  await tx.update(teams).set({ deletedAt: new Date() }).where(eq(teams.id, teamId));
  await tx
    .update(teamInvitations)
    .set({ revokedAt: new Date() })
    .where(and(eq(teamInvitations.teamId, teamId), isNull(teamInvitations.usedAt)));
  await tx.delete(teamMembers).where(eq(teamMembers.teamId, teamId));
  return archiveTeamRooms(tx, teamId);
}
export async function mutateTeam(
  db: Database,
  actor: string,
  input: TeamCommand,
  audit: AuditRecorder,
) {
  const result = await db.transaction(async (tx) => {
    await workspaceAccount(tx, actor);
    const change = await teamChange(tx, actor, input);
    await audit.record(tx, {
      action: `team.${input.kind}`,
      resourceType:
        input.kind === "invite" || input.kind === "revoke" || input.kind === "accept"
          ? "team_invitation"
          : "team",
      resourceId: change.resourceId ?? change.teamId,
      metadata: {
        time: change.teamId,
        pessoa: "userId" in input ? input.userId : undefined,
        funcao: "role" in input ? input.role : undefined,
      },
    });
    return change;
  });
  const statuses = [];
  for (const id of result.commandIds ?? []) statuses.push(await applyRoomCommand(db, id));
  return {
    teamId: result.teamId,
    invitationLink: result.invitationLink,
    deleted: result.deleted,
    left: result.left,
    transportPending: statuses.includes("failed"),
  };
}
async function teamChange(tx: DbExecutor, actor: string, input: TeamCommand): Promise<Outcome> {
  if (input.kind === "create") return createTeam(tx, actor, input.name);
  if (input.kind === "accept") {
    const accepted = await acceptTeamInvitation(tx, input.token, actor);
    return { teamId: accepted.teamId, resourceId: accepted.invitationId };
  }
  return changeTeam(tx, actor, input);
}
