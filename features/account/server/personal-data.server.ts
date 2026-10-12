import { and, count, desc, eq, gt, sql } from "drizzle-orm";
import type { DbExecutor } from "@/server/db/index.server";
import {
  roomParticipations,
  rooms,
  shareSessions,
  tokenRequests,
  users,
  userSessions,
} from "@/server/db/schema";

/**
 * "Baixar meus dados" (download my data; LGPD, art. 18): everything we store linked to the account.
 * The Portuguese keys are the format of the file the person receives.
 */
export async function personalData(db: DbExecutor, userId: string) {
  const [profile] = await db
    .select({
      id: users.id,
      nome: users.name,
      foto: users.image,
      email: users.email,
      emailConfirmado: users.emailVerified,
      duasEtapasAtiva: users.twoFactorEnabled,
      criadaEm: users.createdAt,
      ultimoAcesso: users.lastSeenAt,
    })
    .from(users)
    .where(eq(users.id, userId));
  const sessions = await db
    .select({
      criadaEm: userSessions.createdAt,
      ultimoUso: userSessions.updatedAt,
      expiraEm: userSessions.expiresAt,
      ip: userSessions.ipAddress,
      navegador: userSessions.userAgent,
    })
    .from(userSessions)
    .where(and(eq(userSessions.userId, userId), gt(userSessions.expiresAt, new Date())))
    .orderBy(desc(userSessions.createdAt));

  const participations = await db
    .select({
      sala: rooms.code,
      nomeNaSala: roomParticipations.displayName,
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

  return {
    gerado_em: new Date().toISOString(),
    aviso: "Dados pessoais guardados pelo Nelcota ligados à sua conta.",
    conta: profile,
    sessoes_ativas: sessions,
    // Access records: kept for 6 months (Marco Civil, art. 15).
    participacoes_em_salas: participations,
    pedidos_de_entrada: tokenLog,
  };
}
