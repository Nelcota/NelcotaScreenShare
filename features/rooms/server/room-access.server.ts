import { eq } from "drizzle-orm";
import type { DbExecutor } from "@/server/db/index.server";
import { roomDefinitions } from "@/server/db/schema/room-control";
import { ActionError } from "@/server/operations/action-error";
import { getEnv } from "@/server/env.server";
import { membership } from "@/features/team/server/access.server";
import { eligibleTeamHost, managesTeam } from "@/features/team/domain/team-policy";
import { isGuestIdentity } from "@/features/room/domain/participant-label";
import { AdmissionError, activeAccount } from "@/features/room/server/session-store.server";
import { entitlement, lockProSubject } from "./entitlements.server";

export type RoomDefinition = typeof roomDefinitions.$inferSelect;
export async function canHostDefinition(
  db: DbExecutor,
  definition: RoomDefinition,
  identity: string,
) {
  if (!(await activeAccount(db, identity))) return false;
  if (definition.kind !== "team") return true;
  if (!definition.teamId) return false;
  const member = await membership(db, definition.teamId, identity);
  return Boolean(member && eligibleTeamHost(member.role, definition.memberCanHost));
}
export async function definitionByCode(db: DbExecutor, code: string) {
  const [room] = await db.select().from(roomDefinitions).where(eq(roomDefinitions.code, code));
  return room;
}

/** Reused by loaders, issuance and every cached-token transport handshake. */
export async function assertDefinitionAdmission(
  db: DbExecutor,
  room: RoomDefinition,
  identity: string,
  starting: boolean,
) {
  if (room.archivedAt || room.closedAt)
    throw new AdmissionError("room_closed", "Esta sala está arquivada ou encerrada.");
  if (room.kind === "ad_hoc") return;
  if (!getEnv().ROOM_HOST_CONTROLS_ENABLED)
    throw new AdmissionError(
      "room_closed",
      "Salas permanentes estão indisponíveis nesta instância.",
    );
  if (room.kind === "personal") return assertPersonalAdmission(db, room, identity, starting);
  return assertTeamAdmission(db, room, identity, starting);
}

async function assertPersonalAdmission(
  db: DbExecutor,
  room: RoomDefinition,
  identity: string,
  starting: boolean,
) {
  if (!room.ownerUserId || !(await activeAccount(db, room.ownerUserId)))
    throw new AdmissionError("room_closed", "Esta sala não está disponível.");
  if (!starting && (identity === room.ownerUserId || room.allowGuests)) return;
  if (identity !== room.ownerUserId)
    throw new AdmissionError("room_removed", "Só o dono pode iniciar esta sala.");
  await canStartPro(db, { userId: room.ownerUserId });
  return;
}

async function assertTeamAdmission(
  db: DbExecutor,
  room: RoomDefinition,
  identity: string,
  starting: boolean,
) {
  if (!room.teamId) throw new AdmissionError("room_closed", "Esta sala não está disponível.");
  const member = !isGuestIdentity(identity)
    ? await membership(db, room.teamId, identity)
    : undefined;
  if (!member && (!room.allowGuests || starting))
    throw new AdmissionError("room_removed", "Esta sala é restrita aos membros do time.");
  if (!starting) return;
  if (!member || !eligibleTeamHost(member.role, room.memberCanHost))
    throw new AdmissionError("room_removed", "Só donos e gestores podem iniciar esta chamada.");
  await canStartPro(db, { teamId: room.teamId });
}

export async function accessibleDefinition(
  db: DbExecutor,
  roomId: string,
  userId: string,
  manage = false,
) {
  const [room] = await db.select().from(roomDefinitions).where(eq(roomDefinitions.id, roomId));
  if (!room || room.kind === "ad_hoc") throw new ActionError("Sala não encontrada.");
  if (room.kind === "personal" && room.ownerUserId === userId && (await activeAccount(db, userId)))
    return room;
  if (room.kind === "team" && room.teamId) {
    const member = await membership(db, room.teamId, userId);
    if (member && (!manage || managesTeam(member.role))) return room;
  }
  throw new ActionError("Esta sala não está disponível para sua conta.");
}

async function canStartPro(db: DbExecutor, subject: Parameters<typeof entitlement>[1]) {
  if (!(await entitlement(db, subject)).active)
    throw new AdmissionError(
      "room_closed",
      "O Pro beta está inativo. O histórico permanece disponível, mas novas chamadas precisam de uma ativação.",
    );
}

export async function lockDefinitionPro(db: DbExecutor, room: RoomDefinition | undefined) {
  if (room?.kind === "personal" && room.ownerUserId)
    await lockProSubject(db, { userId: room.ownerUserId });
  if (room?.kind === "team" && room.teamId) await lockProSubject(db, { teamId: room.teamId });
}
