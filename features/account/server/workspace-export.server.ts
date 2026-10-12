import { eq, or } from "drizzle-orm";
import type { DbExecutor } from "@/server/db/index.server";
import {
  teamMembers,
  teams,
  teamInvitations,
  proEntitlements,
} from "@/server/db/schema/workspaces";
import { roomFavorites } from "@/server/db/schema/room-favorites";

export async function workspacePersonalData(db: DbExecutor, userId: string, email: string) {
  const memberships = await db
    .select({
      time: teams.name,
      timeId: teams.id,
      funcao: teamMembers.role,
      entrouEm: teamMembers.createdAt,
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(eq(teamMembers.userId, userId));
  const favorites = await db
    .select({ salaId: roomFavorites.roomId, favoritoEm: roomFavorites.createdAt })
    .from(roomFavorites)
    .where(eq(roomFavorites.userId, userId));
  const invitations = await db
    .select({
      id: teamInvitations.id,
      timeId: teamInvitations.teamId,
      funcao: teamInvitations.role,
      criadaEm: teamInvitations.createdAt,
      expiraEm: teamInvitations.expiresAt,
      aceitoEm: teamInvitations.usedAt,
      revogadoEm: teamInvitations.revokedAt,
    })
    .from(teamInvitations)
    .where(
      or(
        eq(teamInvitations.email, email.toLowerCase()),
        eq(teamInvitations.createdBy, userId),
        eq(teamInvitations.acceptedBy, userId),
      ),
    );
  const pro = await db
    .select({
      ativo: proEntitlements.active,
      limiteSalas: proEntitlements.roomLimit,
      expiraEm: proEntitlements.expiresAt,
    })
    .from(proEntitlements)
    .where(eq(proEntitlements.userId, userId));
  return {
    times: memberships,
    salas_favoritas: favorites,
    convites_de_time: invitations,
    pro_beta: pro,
  };
}
