import { and, eq, inArray, isNull, or } from "drizzle-orm";
import type { DbExecutor } from "@/server/db/index.server";
import {
  teams,
  teamMembers,
  teamInvitations,
  proEntitlements,
} from "@/server/db/schema/workspaces";
import { roomFavorites } from "@/server/db/schema/room-favorites";
import {
  roomDefinitions,
  roomSessions,
  roomSessionMembers,
  roomCommands,
} from "@/server/db/schema/room-control";
import { ActionError } from "@/server/operations/action-error";
import { lockProSubject } from "@/features/rooms/server/entitlements.server";
import { lockTeam } from "@/features/team/server/access.server";
import { deleteTeam } from "@/features/team/server/team-mutations.server";
import { revokeTeamSessions } from "@/features/team/server/session-revocation.server";
import { lockControlRoom } from "@/features/room/server/session-store.server";

export async function ownedTeams(db: DbExecutor, userId: string) {
  return db
    .select({ id: teams.id, name: teams.name })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(
      and(eq(teamMembers.userId, userId), eq(teamMembers.role, "owner"), isNull(teams.deletedAt)),
    )
    .orderBy(teams.id);
}

/** Do not orphan a team silently. The account owner can explicitly close their teams. */
export async function cleanWorkspaceAccount(
  tx: DbExecutor,
  userId: string,
  email: string,
  deleteOwnedTeams = false,
) {
  await lockProSubject(tx, { userId });
  const memberships = await tx
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, userId))
    .orderBy(teamMembers.teamId);
  for (const { teamId } of memberships) await lockTeam(tx, teamId);
  const owned = await ownedTeams(tx, userId);
  if (owned.length && !deleteOwnedTeams)
    throw new ActionError(
      "Transfira a propriedade dos seus times ou confirme a exclusão deles antes de excluir sua conta.",
    );
  for (const { id } of owned) await deleteTeam(tx, id);
  for (const { teamId } of memberships) {
    if (!owned.some((team) => team.id === teamId)) await revokeTeamSessions(tx, teamId, userId);
  }
  await tx.delete(teamMembers).where(eq(teamMembers.userId, userId));
  await tx.delete(roomFavorites).where(eq(roomFavorites.userId, userId));
  await tx.delete(proEntitlements).where(eq(proEntitlements.userId, userId));
  await tx.delete(teamInvitations).where(eq(teamInvitations.email, email.toLowerCase()));
  await tx
    .update(teamInvitations)
    .set({ createdBy: null, revokedAt: new Date() })
    .where(eq(teamInvitations.createdBy, userId));
  await tx
    .update(teamInvitations)
    .set({ acceptedBy: null })
    .where(eq(teamInvitations.acceptedBy, userId));
  await tx
    .update(roomDefinitions)
    .set({ archivedAt: new Date() })
    .where(and(eq(roomDefinitions.ownerUserId, userId), eq(roomDefinitions.kind, "personal")));
  await revokeWorkspaceIdentity(tx, userId, true);
}

/** Close owned personal calls and exclude the identity from all other controlled calls. */
export async function revokeWorkspaceIdentity(
  tx: DbExecutor,
  userId: string,
  closePersonal = false,
) {
  const admitted = tx
    .select({ id: roomSessionMembers.sessionId })
    .from(roomSessionMembers)
    .where(eq(roomSessionMembers.userId, userId));
  const calls = await tx
    .select({ session: roomSessions, room: roomDefinitions })
    .from(roomSessions)
    .innerJoin(roomDefinitions, eq(roomDefinitions.id, roomSessions.definitionId))
    .where(
      and(
        isNull(roomSessions.closedAt),
        or(
          inArray(roomSessions.id, admitted),
          closePersonal
            ? and(eq(roomDefinitions.ownerUserId, userId), eq(roomDefinitions.kind, "personal"))
            : undefined,
        ),
      ),
    )
    .orderBy(roomDefinitions.code);
  for (const { session, room } of calls) {
    await lockControlRoom(tx, room.code);
    const close = closePersonal && room.kind === "personal" && room.ownerUserId === userId;
    await tx
      .update(roomSessionMembers)
      .set({ excludedAt: new Date() })
      .where(
        and(eq(roomSessionMembers.sessionId, session.id), eq(roomSessionMembers.identity, userId)),
      );
    if (close)
      await tx
        .update(roomSessions)
        .set({ status: "closed", closedAt: new Date(), admissionLocked: true })
        .where(eq(roomSessions.id, session.id));
    if (!close)
      await tx
        .update(roomSessions)
        .set({ hostUserId: null, hostMissingAt: new Date(Date.now() - 60_001) })
        .where(and(eq(roomSessions.id, session.id), eq(roomSessions.hostUserId, userId)));
    await tx.insert(roomCommands).values({
      sessionId: session.id,
      kind: close ? "close" : "remove",
      targetIdentity: close ? undefined : userId,
    });
  }
}
