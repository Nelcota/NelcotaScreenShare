import { and, eq } from "drizzle-orm";
import type { ParticipantInfo } from "livekit-server-sdk";
import type { DbExecutor } from "@/server/db/index.server";
import { roomDefinitions, roomSessions, roomSessionMembers } from "@/server/db/schema/room-control";
import { ActionError } from "@/server/operations/action-error";
import type { HostCommand } from "@/features/room/domain/host-controls";
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
  actor: string,
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
    await transferHost(tx, session, input.identity, participants, actor);
    return { kind: "sync", targetIdentity: input.identity };
  }
  if (input.kind === "remove") {
    if (input.identity === actor)
      throw new ActionError("Para sair, use Sair da sala ou transfira a função de anfitrião.");
    const member = await memberInSession(tx, session.id, input.identity);
    if (!member?.admittedAt) throw new ActionError("Esta pessoa não pertence à chamada.");
    await tx
      .update(roomSessionMembers)
      .set({ excludedAt: new Date() })
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
  await tx
    .update(roomDefinitions)
    .set({ closedAt: new Date() })
    .where(eq(roomDefinitions.id, session.definitionId));
  return { kind: "close" };
}

export function hostAuditMetadata(input: HostCommand) {
  if (input.kind === "lock") return { bloqueada: input.locked };
  if (input.kind === "sharing") return { politica: input.policy, permitidos: input.allowed };
  return {};
}
