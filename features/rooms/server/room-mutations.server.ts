import { and, count, eq, isNull } from "drizzle-orm";
import type { Database, DbExecutor } from "@/server/db/index.server";
import { roomDefinitions, roomSessions } from "@/server/db/schema/room-control";
import { roomFavorites } from "@/server/db/schema/room-favorites";
import { getEnv } from "@/server/env.server";
import { ActionError } from "@/server/operations/action-error";
import type { AuditRecorder } from "@/server/audit.server";
import type { RoomWorkspaceCommand } from "@/features/rooms/domain/commands";
import { lockControlRoom } from "@/features/room/server/session-store.server";
import {
  lockTeam,
  requireMembership,
  workspaceAccount,
} from "@/features/team/server/access.server";
import { accessibleDefinition, type RoomDefinition } from "./room-access.server";
import { claimRoomAddress, drawnRoomAddress } from "./room-address.server";
import { lockProSubject, requireEntitlement, type ProSubject } from "./entitlements.server";

async function allowance(tx: DbExecutor, subject: ProSubject) {
  await lockProSubject(tx, subject);
  const pro = await requireEntitlement(tx, subject);
  const subjectRooms =
    "teamId" in subject
      ? eq(roomDefinitions.teamId, subject.teamId)
      : and(eq(roomDefinitions.ownerUserId, subject.userId), eq(roomDefinitions.kind, "personal"));
  const [used] = await tx
    .select({ total: count() })
    .from(roomDefinitions)
    .where(and(subjectRooms, isNull(roomDefinitions.archivedAt)));
  if ((used?.total ?? 0) >= pro.roomLimit)
    throw new ActionError(
      "Você atingiu o limite de salas do Pro beta. Arquive uma sala para criar outra.",
    );
}
async function createRoom(
  tx: DbExecutor,
  actor: string,
  input: Extract<RoomWorkspaceCommand, { kind: "create" }>,
  mayUseReservedWords: boolean,
) {
  if (!getEnv().ROOM_HOST_CONTROLS_ENABLED)
    throw new ActionError("Salas permanentes estão indisponíveis nesta instância.");
  if (input.teamId) {
    await lockTeam(tx, input.teamId);
    await requireMembership(tx, input.teamId, actor, "manage");
  }
  await allowance(tx, input.teamId ? { teamId: input.teamId } : { userId: actor });
  if (input.code) await claimRoomAddress(tx, input.code, mayUseReservedWords);
  const [room] = await tx
    .insert(roomDefinitions)
    .values({
      code: input.code ?? drawnRoomAddress(),
      kind: input.teamId ? "team" : "personal",
      name: input.name,
      ownerUserId: input.teamId ? null : actor,
      teamId: input.teamId,
      allowGuests: input.allowGuests,
      memberCanHost: input.memberCanHost,
    })
    .returning();
  if (!room) throw new Error("Permanent room was not saved");
  return room;
}
async function changeRoom(
  tx: DbExecutor,
  actor: string,
  input: Exclude<RoomWorkspaceCommand, { kind: "create" }>,
) {
  const room = await accessibleDefinition(tx, input.roomId, actor, input.kind !== "favorite");
  await lockRoomMutation(tx, room, actor, input);
  // Recheck after acquiring locks: a removed membership or archived owner cannot authorize stale data.
  const current = await accessibleDefinition(tx, room.id, actor, input.kind !== "favorite");
  if (input.kind === "favorite") {
    await favoriteRoom(tx, current, actor, input.favorite);
    return current;
  }
  if (input.kind === "edit") {
    const [edited] = await tx
      .update(roomDefinitions)
      .set({ name: input.name, allowGuests: input.allowGuests, memberCanHost: input.memberCanHost })
      .where(eq(roomDefinitions.id, current.id))
      .returning();
    return edited ?? current;
  }
  if (!input.archived && current.archivedAt)
    await allowance(tx, current.teamId ? { teamId: current.teamId } : { userId: actor });
  const [active] = await tx
    .select({ id: roomSessions.id })
    .from(roomSessions)
    .where(and(eq(roomSessions.definitionId, current.id), isNull(roomSessions.closedAt)));
  if (input.archived && active)
    throw new ActionError("Encerre a chamada ativa antes de arquivar esta sala.");
  const [archived] = await tx
    .update(roomDefinitions)
    .set({ archivedAt: input.archived ? new Date() : null })
    .where(eq(roomDefinitions.id, current.id))
    .returning();
  return archived ?? current;
}
async function favoriteRoom(
  tx: DbExecutor,
  room: RoomDefinition,
  userId: string,
  favorite: boolean,
) {
  if (!favorite) {
    await tx
      .delete(roomFavorites)
      .where(and(eq(roomFavorites.roomId, room.id), eq(roomFavorites.userId, userId)));
    return;
  }
  if (room.archivedAt) throw new ActionError("Esta sala está arquivada.");
  await tx.insert(roomFavorites).values({ roomId: room.id, userId }).onConflictDoNothing();
}
export async function mutateWorkspaceRoom(
  db: Database,
  actor: string,
  input: RoomWorkspaceCommand,
  audit: AuditRecorder,
  /** Whether a chosen address may carry a reserved word ("nelcota-staff"). */
  { mayUseReservedWords = false }: { mayUseReservedWords?: boolean } = {},
) {
  return db.transaction(async (tx) => {
    await workspaceAccount(tx, actor);
    const room =
      input.kind === "create"
        ? await createRoom(tx, actor, input, mayUseReservedWords)
        : await changeRoom(tx, actor, input);
    await audit.record(tx, {
      action: `permanent_room.${input.kind}`,
      resourceType: "room_definition",
      resourceId: room.id,
      metadata: { time: room.teamId },
    });
    return { roomId: room.id, code: room.code };
  });
}

async function lockRoomMutation(
  tx: DbExecutor,
  room: RoomDefinition,
  actor: string,
  input: Exclude<RoomWorkspaceCommand, { kind: "create" }>,
) {
  if (room.teamId) {
    await lockTeam(tx, room.teamId);
    await requireMembership(tx, room.teamId, actor, input.kind === "favorite" ? "read" : "manage");
  }
  if (input.kind === "archive" && !input.archived)
    await lockProSubject(tx, room.teamId ? { teamId: room.teamId } : { userId: actor });
  await lockControlRoom(tx, room.code);
}
