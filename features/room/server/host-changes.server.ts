import { canHostDefinition } from "@/features/rooms/server/room-access.server";
import { and, eq } from "drizzle-orm";
import type { ParticipantInfo } from "livekit-server-sdk";
import type { DbExecutor } from "@/server/db/index.server";
import { roomDefinitions, roomSessions, roomSessionMembers } from "@/server/db/schema/room-control";
import { ActionError } from "@/server/operations/action-error";
import type { HostCommand } from "@/features/room/domain/host-controls";
import { canModerate } from "@/features/room/domain/moderation";
import { closeEndsRoom } from "@/features/room/domain/room-host";
import type { RoomRole } from "@/features/room/domain/room-role";
import { roomRoles } from "@/server/db/schema";
import { roomRoleOf } from "./room-roles.server";
import { isPermanentRoom, transferOwnership } from "./role-changes.server";

/** Who gives the command: their account and the role saved for the room. */
interface HostActor {
  identity: string;
  role: RoomRole;
}
import { activeAccount, memberInSession, type ControlSession } from "./session-store.server";

async function transferHost(
  tx: DbExecutor,
  session: ControlSession,
  identity: string,
  participants: readonly ParticipantInfo[],
  actor: string,
) {
  if (
    identity === actor ||
    !participants.some((person) => person.identity === identity) ||
    !(await activeAccount(tx, identity))
  )
    throw new ActionError("Escolha outra pessoa com conta que esteja nesta chamada.");
  const [definition] = await tx
    .select()
    .from(roomDefinitions)
    .where(eq(roomDefinitions.id, session.definitionId));
  if (!definition || !(await canHostDefinition(tx, definition, identity)))
    throw new ActionError("Esta pessoa não pode ser anfitriã deste time.");
  const member = await memberInSession(tx, session.id, identity);
  if (!member?.admittedAt || member.excludedAt)
    throw new ActionError("Esta pessoa não pode ser anfitriã.");
  await tx
    .update(roomSessions)
    .set({ hostUserId: identity, hostMissingAt: null })
    .where(eq(roomSessions.id, session.id));
}

export async function applyHostChange(
  tx: DbExecutor,
  session: ControlSession,
  input: HostCommand,
  participants: readonly ParticipantInfo[],
  actor: HostActor,
): Promise<{ kind: "sync" | "remove" | "close"; targetIdentity?: string }> {
  if (input.kind === "lock") {
    await tx
      .update(roomSessions)
      .set({ admissionLocked: input.locked })
      .where(eq(roomSessions.id, session.id));
    return { kind: "sync" };
  }
  if (input.kind === "sharing") {
    const identities = new Set(participants.map((person) => person.identity));
    if (input.allowed.some((identity) => !identities.has(identity)))
      throw new ActionError("Escolha apenas pessoas que estão nesta chamada.");
    await tx
      .update(roomSessions)
      .set({ sharePolicy: input.policy, allowedSharers: [...new Set(input.allowed)] })
      .where(eq(roomSessions.id, session.id));
    return { kind: "sync" };
  }
  if (input.kind === "transfer") {
    await assertOwnerMayTransfer(tx, session, actor);
    await transferHost(tx, session, input.identity, participants, actor.identity);
    // From the owner, the room goes too: otherwise the owner, still here, would take the
    // host back at once.
    if (actor.role === "owner")
      await transferOwnership(tx, {
        roomCode: await codeOf(tx, session),
        fromUserId: actor.identity,
        toUserId: input.identity,
      });
    return { kind: "sync", targetIdentity: input.identity };
  }
  if (input.kind === "remove") {
    if (input.identity === actor.identity)
      throw new ActionError("Para sair, use Sair da sala ou transfira a função de anfitrião.");
    await assertMayRemove(tx, session, actor, input.identity);
    const member = await memberInSession(tx, session.id, input.identity);
    if (!member?.admittedAt) throw new ActionError("Esta pessoa não pertence à chamada.");
    await tx
      .update(roomSessionMembers)
      .set({ excludedAt: new Date(), excludedByUserId: actor.identity, excludedByAdminId: null })
      .where(
        and(
          eq(roomSessionMembers.sessionId, session.id),
          eq(roomSessionMembers.identity, input.identity),
        ),
      );
    return { kind: "remove", targetIdentity: input.identity };
  }
  await tx
    .update(roomSessions)
    .set({ status: "closed", closedAt: session.closedAt ?? new Date(), admissionLocked: true })
    .where(eq(roomSessions.id, session.id));
  await closeRoomWithoutOwner(tx, session);
  return { kind: "close" };
}

/**
 * The owner removes anyone. The host removes anyone but the owner, who may be away for a
 * moment (a reconnect) and would come back shut out of their own room. A moderator, as
 * co-host, removes participants only, never the host, the owner or another moderator.
 */
async function assertMayRemove(
  tx: DbExecutor,
  session: ControlSession,
  actor: HostActor,
  identity: string,
) {
  if (actor.role === "owner") return;
  const roomCode = await codeOf(tx, session);
  const target = isAccountIdentity(identity)
    ? await roomRoleOf(tx, { roomCode, userId: identity })
    : "participant";
  if (target === "owner") throw new ActionError("Ninguém remove o dono da sala.");
  if (session.hostUserId === actor.identity) return;
  if (identity === session.hostUserId || !canModerate(actor.role, target))
    throw new ActionError("Moderadores só removem participantes.");
}

/**
 * The owner's transfer also hands over the room, and a permanent room is not handed over.
 * Giving only the host would not last either: the owner, still here, takes it back.
 */
async function assertOwnerMayTransfer(tx: DbExecutor, session: ControlSession, actor: HostActor) {
  if (actor.role !== "owner") return;
  if (!(await isPermanentRoom(tx, await codeOf(tx, session)))) return;
  throw new ActionError("Numa sala permanente, o dono continua anfitrião enquanto estiver aqui.");
}

/** A room someone owns stays for the next call; only an ownerless ad hoc room closes. */
async function closeRoomWithoutOwner(tx: DbExecutor, session: ControlSession) {
  const [definition] = await tx
    .select({ code: roomDefinitions.code, kind: roomDefinitions.kind })
    .from(roomDefinitions)
    .where(eq(roomDefinitions.id, session.definitionId));
  if (!definition) return;
  const [owner] = await tx
    .select({ userId: roomRoles.userId })
    .from(roomRoles)
    .where(and(eq(roomRoles.roomCode, definition.code), eq(roomRoles.role, "owner")))
    .limit(1);
  if (!closeEndsRoom({ kind: definition.kind, hasOwner: owner !== undefined })) return;
  await tx
    .update(roomDefinitions)
    .set({ closedAt: new Date() })
    .where(eq(roomDefinitions.id, session.definitionId));
}

async function codeOf(tx: DbExecutor, session: ControlSession) {
  const [definition] = await tx
    .select({ code: roomDefinitions.code })
    .from(roomDefinitions)
    .where(eq(roomDefinitions.id, session.definitionId));
  if (!definition) throw new ActionError("Esta chamada não está disponível.");
  return definition.code;
}

/** Accounts are UUIDs; guests (`convidado-…`) have no saved role. */
function isAccountIdentity(identity: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identity);
}

export function hostAuditMetadata(input: HostCommand) {
  if (input.kind === "lock") return { bloqueada: input.locked };
  if (input.kind === "sharing") return { politica: input.policy, permitidos: input.allowed };
  return {};
}
