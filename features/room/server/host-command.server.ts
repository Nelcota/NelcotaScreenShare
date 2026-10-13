import { canHostDefinition } from "@/features/rooms/server/room-access.server";
import { eq } from "drizzle-orm";
import type { Database } from "@/server/db/index.server";
import { roomCommands, roomSessions } from "@/server/db/schema/room-control";
import type { AuditRecorder } from "@/server/audit.server";
import { ActionError } from "@/server/operations/action-error";
import type { HostCommand } from "@/features/room/domain/host-controls";
import { activeAccount, lockControlRoom, sessionByMediaName } from "./session-store.server";
import { controlGateway } from "./control-gateway.server";
import { reconcileSessionPresence } from "./session-presence.server";
import { applyRoomCommand } from "./control-commands.server";
import { applyHostChange, hostAuditMetadata } from "./host-changes.server";
import { roomRoleOf } from "./room-roles.server";
import { canRunHostCommand, type HostCommandKind } from "@/features/room/domain/room-host";

/** A moderator who tries to hand over or end the call is told who can. */
function refusalFor(kind: HostCommandKind) {
  if (kind === "transfer" || kind === "close")
    return "Só o anfitrião ou o dono da sala pode fazer isso.";
  return "Só o anfitrião, o dono ou um moderador pode alterar esta sala.";
}

/** Authorization is repeated under the same lock as admission and host transfer. */
export async function executeHostCommand(
  db: Database,
  actor: string,
  input: HostCommand,
  audit: AuditRecorder,
) {
  const commandId = await db.transaction(async (tx) => {
    await lockControlRoom(tx, input.room);
    const [initial] = await tx
      .select()
      .from(roomSessions)
      .where(eq(roomSessions.id, input.sessionId));
    if (!initial) throw new ActionError("Esta chamada não está disponível.");
    const definition = await sessionByMediaName(tx, initial.mediaRoomName);
    if (!definition || definition.code !== input.room)
      throw new ActionError("Esta chamada não está disponível.");
    if (
      !(await activeAccount(tx, actor)) ||
      !(await canHostDefinition(tx, definition.definition, actor))
    )
      throw new ActionError("Sua conta não pode moderar salas.");
    const participants = await controlGateway.participants(initial.mediaRoomName);
    const session = await reconcileSessionPresence(tx, initial, participants, new Date());
    const actorRole = await roomRoleOf(tx, { roomCode: input.room, userId: actor });
    if (!canRunHostCommand({ isHost: session.hostUserId === actor, role: actorRole }, input.kind))
      throw new ActionError(refusalFor(input.kind));
    if (session.status !== "closed" && !participants.some((person) => person.identity === actor))
      throw new ActionError("Entre nesta chamada para moderá-la.");
    if (session.status === "closed" && input.kind !== "close")
      throw new ActionError("Esta chamada já foi encerrada.");

    const { kind, targetIdentity } = await applyHostChange(tx, session, input, participants, {
      identity: actor,
      role: actorRole,
    });
    const [command] = await tx
      .insert(roomCommands)
      .values({ sessionId: session.id, kind, targetIdentity })
      .returning({ id: roomCommands.id });
    if (!command) throw new Error("Room command was not saved");
    await audit.record(tx, {
      action: `room.${input.kind}`,
      resourceType: "room_session",
      resourceId: session.id,
      metadata: {
        ...hostAuditMetadata(input),
        sala: input.room,
        comando: command.id,
        pessoa: targetIdentity,
      },
    });
    return command.id;
  });
  return { commandId, status: await applyRoomCommand(db, commandId) };
}
