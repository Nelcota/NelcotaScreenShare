import { canHostDefinition } from "@/features/rooms/server/room-access.server";
import { eq } from "drizzle-orm";
import type { ParticipantInfo } from "livekit-server-sdk";
import type { DbExecutor } from "@/server/db/index.server";
import { roomCommands, roomDefinitions, roomSessions } from "@/server/db/schema/room-control";
import { HOST_RECONNECT_GRACE_MS } from "@/features/room/domain/host-controls";
import { createAuditRecorder } from "@/server/audit.server";
import { activeAccount, memberInSession, type ControlSession } from "./session-store.server";

/** Presence can trigger an audited election; webhook metadata never grants a role. */
export async function reconcileSessionPresence(
  tx: DbExecutor,
  session: ControlSession,
  participants: readonly ParticipantInfo[],
  now: Date,
): Promise<ControlSession> {
  if (session.status === "closed") return session;
  const host = await hostStatus(tx, session, participants);
  if (host.present) {
    const [updated] = await tx
      .update(roomSessions)
      .set({ status: "active", hostMissingAt: null, emptySince: null })
      .where(eq(roomSessions.id, session.id))
      .returning();
    return updated ?? session;
  }
  const times = presenceTimes(session, participants.length, now);
  const emptySince = times.emptySince;
  const missingSince = host.ineligible
    ? new Date(now.getTime() - HOST_RECONNECT_GRACE_MS - 1)
    : times.missingSince;
  if (emptySince && now.getTime() - emptySince.getTime() >= HOST_RECONNECT_GRACE_MS) {
    const [closed] = await tx
      .update(roomSessions)
      .set({ status: "closed", closedAt: now, hostMissingAt: missingSince, emptySince })
      .where(eq(roomSessions.id, session.id))
      .returning();
    await tx.insert(roomCommands).values({ sessionId: session.id, kind: "close" });
    return closed ?? session;
  }
  const changes = {
    hostMissingAt: missingSince,
    emptySince,
    status: participants.length > 0 ? ("active" as const) : session.status,
  };
  if (now.getTime() - missingSince.getTime() < HOST_RECONNECT_GRACE_MS) {
    const [waiting] = await tx
      .update(roomSessions)
      .set(changes)
      .where(eq(roomSessions.id, session.id))
      .returning();
    return waiting ?? session;
  }
  const elected = await electHost(tx, session, participants, changes);
  if (elected) return elected;
  const [waiting] = await tx
    .update(roomSessions)
    .set({
      ...changes,
      admissionLocked: true,
      hostUserId: host.ineligible ? null : session.hostUserId,
    })
    .where(eq(roomSessions.id, session.id))
    .returning();
  if (host.ineligible)
    await tx.insert(roomCommands).values({ sessionId: session.id, kind: "sync" });
  return waiting ?? session;
}

async function electHost(
  tx: DbExecutor,
  session: ControlSession,
  participants: readonly ParticipantInfo[],
  changes: { hostMissingAt: Date; emptySince: Date | null; status: ControlSession["status"] },
) {
  for (const participant of participants.toSorted(
    (a, b) => Number(a.joinedAt - b.joinedAt) || a.identity.localeCompare(b.identity),
  )) {
    const member = await memberInSession(tx, session.id, participant.identity);
    if (!member?.admittedAt || member.excludedAt) continue;
    const account = await activeAccount(tx, participant.identity);
    if (!account || !(await eligibleHost(tx, session, account.id))) continue;
    const [elected] = await tx
      .update(roomSessions)
      .set({ ...changes, hostUserId: account.id, hostMissingAt: null })
      .where(eq(roomSessions.id, session.id))
      .returning();
    await tx.insert(roomCommands).values({ sessionId: session.id, kind: "sync" });
    await createAuditRecorder("system").record(tx, {
      action: "room.host_transfer",
      resourceType: "room_session",
      resourceId: session.id,
      metadata: { motivo: "host_absent", anfitriao: account.id },
    });
    return elected ?? session;
  }
  return undefined;
}

async function hostStatus(
  tx: DbExecutor,
  session: ControlSession,
  participants: readonly ParticipantInfo[],
) {
  const eligible = session.hostUserId ? await eligibleHost(tx, session, session.hostUserId) : false;
  return {
    present: eligible && participants.some((person) => person.identity === session.hostUserId),
    ineligible: Boolean(session.hostUserId && !eligible),
  };
}

function presenceTimes(session: ControlSession, count: number, now: Date) {
  const beginning = session.status === "pending" ? session.createdAt : now;
  return {
    missingSince: session.hostMissingAt ?? beginning,
    emptySince: count === 0 ? (session.emptySince ?? beginning) : null,
  };
}

async function eligibleHost(tx: DbExecutor, session: ControlSession, identity: string) {
  const [definition] = await tx
    .select()
    .from(roomDefinitions)
    .where(eq(roomDefinitions.id, session.definitionId));
  return Boolean(definition && (await canHostDefinition(tx, definition, identity)));
}
