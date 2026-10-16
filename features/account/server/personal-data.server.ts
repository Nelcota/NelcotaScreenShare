import { visibleFriendshipTo } from "@/features/friends/server/friend-list.server";
import { messageData } from "@/features/messages/server/message-privacy.server";
import type { DbExecutor } from "@/server/db/index.server";
import { FRIENDSHIP_STATUS_IN_EXPORT } from "@/features/friends/domain/friendship";
import { OWN_STATUS_LABEL } from "@/features/friends/domain/presence-status";
import { reportsFiledBy } from "@/features/reports/server/personal-data.server";
import { profileChangesOf } from "@/features/admin/participants/server/moderation-export.server";
import { and, count, desc, eq, gt, or, sql } from "drizzle-orm";
import { workspacePersonalData } from "./workspace-export.server";
import { roomDefinitions, roomSessionMembers, roomSessions } from "@/server/db/schema/room-control";
import { ROOM_ROLE_IN_EXPORT, TOKEN_RESULT_IN_EXPORT } from "@/features/room/domain/export-labels";
import {
  friendCodes,
  friendLinks,
  friendships,
  roomBans,
  roomParticipations,
  roomRoles,
  rooms,
  shareSessions,
  tokenRequests,
  userBlocks,
  userPresence,
  users,
  userSessions,
} from "@/server/db/schema";

/** The chosen status, the friend code and the link's version, if any. */
async function friendSettings(db: DbExecutor, userId: string) {
  const [code] = await db
    .select({ codigo: friendCodes.code, criado_em: friendCodes.createdAt })
    .from(friendCodes)
    .where(eq(friendCodes.userId, userId));
  const [link] = await db
    .select({ versao: friendLinks.version, criado_em: friendLinks.createdAt })
    .from(friendLinks)
    .where(eq(friendLinks.userId, userId));
  const [presence] = await db
    .select({ status: userPresence.status, atualizado_em: userPresence.updatedAt })
    .from(userPresence)
    .where(eq(userPresence.userId, userId));
  return {
    status_escolhido: presence
      ? { status: OWN_STATUS_LABEL[presence.status], atualizado_em: presence.atualizado_em }
      : null,
    codigo_de_amigo: code ?? null,
    link_de_amigo: link ?? null,
  };
}

/**
 * "Baixar meus dados" (download my data; LGPD, art. 18): everything we store linked to the account.
 * The Portuguese snake_case keys and values are the format of the file the person receives.
 */
export async function personalData(db: DbExecutor, userId: string) {
  const [profile] = await db
    .select({
      id: users.id,
      nome: users.name,
      foto: users.image,
      email: users.email,
      email_confirmado: users.emailVerified,
      duas_etapas_ativa: users.twoFactorEnabled,
      criada_em: users.createdAt,
      ultimo_acesso: users.lastSeenAt,
    })
    .from(users)
    .where(eq(users.id, userId));
  const sessions = await db
    .select({
      criada_em: userSessions.createdAt,
      ultimo_uso: userSessions.updatedAt,
      expira_em: userSessions.expiresAt,
      ip: userSessions.ipAddress,
      navegador: userSessions.userAgent,
    })
    .from(userSessions)
    .where(and(eq(userSessions.userId, userId), gt(userSessions.expiresAt, new Date())))
    .orderBy(desc(userSessions.createdAt));

  const participations = await db
    .select({
      sala: rooms.code,
      nome_na_sala: roomParticipations.displayName,
      entrou: roomParticipations.joinedAt,
      saiu: roomParticipations.leftAt,
      ip: sql<string | null>`host(${roomParticipations.ip})`,
      compartilhamentos: count(shareSessions.id),
    })
    .from(roomParticipations)
    .innerJoin(rooms, eq(rooms.id, roomParticipations.roomId))
    .leftJoin(shareSessions, eq(shareSessions.participationId, roomParticipations.id))
    .where(eq(roomParticipations.userId, userId))
    .groupBy(roomParticipations.id, rooms.code)
    .orderBy(desc(roomParticipations.joinedAt));
  const tokenLog = await db
    .select({
      sala: tokenRequests.roomCode,
      resultado: tokenRequests.result,
      ip: sql<string | null>`host(${tokenRequests.ip})`,
      quando: tokenRequests.createdAt,
    })
    .from(tokenRequests)
    .where(eq(tokenRequests.userId, userId))
    .orderBy(desc(tokenRequests.createdAt));

  const friendRows = await db
    .select({
      pessoa: users.name,
      situacao: friendships.status,
      pedido_feito_por_voce: sql<boolean>`${friendships.requestedBy} = ${userId}`,
      desde: friendships.createdAt,
      aceita_em: friendships.acceptedAt,
    })
    .from(friendships)
    .innerJoin(
      users,
      sql`${users.id} = case when ${friendships.userLowId} = ${userId} then ${friendships.userHighId} else ${friendships.userLowId} end`,
    )
    .where(
      and(
        or(eq(friendships.userLowId, userId), eq(friendships.userHighId, userId)),
        visibleFriendshipTo(userId),
      ),
    )
    .orderBy(desc(friendships.createdAt));
  const blocked = await db
    .select({ pessoa: users.name, desde: userBlocks.createdAt })
    .from(userBlocks)
    .innerJoin(users, eq(users.id, userBlocks.blockedId))
    .where(eq(userBlocks.blockerId, userId))
    .orderBy(desc(userBlocks.createdAt));
  const roomsCreated = await db
    .select({ sala: roomDefinitions.code, criada_em: roomDefinitions.createdAt })
    .from(roomDefinitions)
    .where(and(eq(roomDefinitions.ownerUserId, userId), eq(roomDefinitions.kind, "ad_hoc")))
    .orderBy(desc(roomDefinitions.createdAt));
  const roles = await db
    .select({ sala: roomRoles.roomCode, papel: roomRoles.role, desde: roomRoles.createdAt })
    .from(roomRoles)
    .where(eq(roomRoles.userId, userId))
    .orderBy(desc(roomRoles.createdAt));
  const bans = await db
    .select({ sala: roomBans.roomCode, quando: roomBans.createdAt })
    .from(roomBans)
    .where(eq(roomBans.identity, userId))
    .orderBy(desc(roomBans.createdAt));

  const definitions = await db
    .select({
      sala: roomDefinitions.code,
      nome: roomDefinitions.name,
      tipo: roomDefinitions.kind,
      arquivadaEm: roomDefinitions.archivedAt,
      criadaEm: roomDefinitions.createdAt,
      encerradaEm: roomDefinitions.closedAt,
    })
    .from(roomDefinitions)
    .where(eq(roomDefinitions.ownerUserId, userId));
  const admissions = await db
    .select({
      sala: roomDefinitions.code,
      chamada: roomSessions.id,
      admitidoEm: roomSessionMembers.admittedAt,
      excluidoEm: roomSessionMembers.excludedAt,
    })
    .from(roomSessionMembers)
    .innerJoin(roomSessions, eq(roomSessions.id, roomSessionMembers.sessionId))
    .innerJoin(roomDefinitions, eq(roomDefinitions.id, roomSessions.definitionId))
    .where(eq(roomSessionMembers.userId, userId));
  return {
    ...(await workspacePersonalData(db, userId, profile?.email ?? "")),
    gerado_em: new Date().toISOString(),
    aviso: "Dados pessoais guardados pelo Nelcota ligados à sua conta.",
    conta: profile,
    sessoes_ativas: sessions,
    // Access records: kept for 6 months (Marco Civil, art. 15).
    participacoes_em_salas: participations,
    pedidos_de_entrada: tokenLog.map((attempt) => ({
      ...attempt,
      resultado: TOKEN_RESULT_IN_EXPORT[attempt.resultado],
    })),
    amizades: friendRows.map((row) => ({
      ...row,
      situacao: FRIENDSHIP_STATUS_IN_EXPORT[row.situacao],
    })),
    pessoas_bloqueadas: blocked,
    ...(await friendSettings(db, userId)),
    salas_criadas: roomsCreated,
    papeis_em_salas: roles.map((role) => ({ ...role, papel: ROOM_ROLE_IN_EXPORT[role.papel] })),
    // Kept for a week after each ban.
    banimentos_de_chamadas: bans,
    ...(await messageData(db, userId)),
    denuncias_feitas: await reportsFiledBy(db, userId),
    alteracoes_feitas_pela_equipe: await profileChangesOf(db, userId),
    salas_permanentes: definitions,
    admissoes_em_chamadas: admissions,
  };
}
