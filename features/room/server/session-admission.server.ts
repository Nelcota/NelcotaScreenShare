import {
  assertDefinitionAdmission,
  definitionByCode,
  lockDefinitionPro,
} from "@/features/rooms/server/room-access.server";
import { and, eq, gt, isNull, ne } from "drizzle-orm";
import type { Database } from "@/server/db/index.server";
import { roomDefinitions, roomSessionMembers, roomSessions } from "@/server/db/schema/room-control";
import type { TokenGrant } from "@/features/room/domain/issue-token";
import { ADMISSION_LEASE_MS, mayShareScreen } from "@/features/room/domain/host-controls";
import { isGuestIdentity } from "@/features/room/domain/participant-label";
import {
  AdmissionError,
  activeAccount,
  assertAdmission,
  lockControlRoom,
  memberInSession,
  openControlSession,
} from "./session-store.server";
import { controlGateway } from "./control-gateway.server";
import { reconcileSessionPresence } from "./session-presence.server";
import { createAuditRecorder } from "@/server/audit.server";

/** Claim the host and reserve capacity atomically before issuing any media credential. */
export async function reserveAdmission(
  db: Database,
  grant: TokenGrant,
  max: number,
  now = new Date(),
) {
  const initial = await definitionByCode(db, grant.room);
  return db.transaction(async (tx) => {
    await lockDefinitionPro(tx, initial);
    await lockControlRoom(tx, grant.room);
    const guest = isGuestIdentity(grant.identity);
    if (!guest && !(await activeAccount(tx, grant.identity)))
      throw new AdmissionError("room_removed", "Sua conta não pode entrar em salas.");
    // Every room has its definition from creation (or migration 0021). One missing now was
    // deleted meanwhile (its owner's account went): admission never recreates it.
    const [definition] = await tx
      .select()
      .from(roomDefinitions)
      .where(eq(roomDefinitions.code, grant.room))
      .limit(1);
    if (!definition) throw new AdmissionError("room_closed", "Esta sala não existe mais.");
    if (definition.closedAt)
      throw new AdmissionError(
        "room_closed",
        "Esta sala foi encerrada pelo anfitrião. Crie uma nova sala.",
      );
    let session = await openControlSession(tx, grant.room);
    if (session)
      session = await reconcileSessionPresence(
        tx,
        session,
        await controlGateway.participants(session.mediaRoomName),
        now,
      );
    await assertDefinitionAdmission(
      tx,
      definition,
      grant.identity,
      !session || session.status === "closed",
    );
    if (!session || session.status === "closed") {
      if (guest)
        throw new AdmissionError(
          "host_absent",
          "A sala ainda não começou. Espere quem te convidou entrar.",
        );
      const sessionId = crypto.randomUUID();
      const [created] = await tx
        .insert(roomSessions)
        .values({
          id: sessionId,
          definitionId: definition.id,
          mediaRoomName: `nelcota-${sessionId}`,
          hostUserId: grant.identity,
        })
        .returning();
      if (!created) throw new Error("Room session was not saved");
      session = created;
      await createAuditRecorder({ userId: grant.identity }).record(tx, {
        action: "room.host_claim",
        resourceType: "room_session",
        resourceId: session.id,
        metadata: { sala: grant.room },
      });
    }
    const member = await memberInSession(tx, session.id, grant.identity);
    assertAdmission(session, member);
    const participants = await controlGateway.participants(session.mediaRoomName);
    const online = new Set(participants.map((person) => person.identity));
    const reservations = await tx
      .select({ identity: roomSessionMembers.identity })
      .from(roomSessionMembers)
      .where(
        and(
          eq(roomSessionMembers.sessionId, session.id),
          isNull(roomSessionMembers.excludedAt),
          gt(roomSessionMembers.reservedUntil, now),
          ne(roomSessionMembers.identity, grant.identity),
        ),
      );
    const occupied = new Set([...online, ...reservations.map((entry) => entry.identity)]);
    occupied.delete(grant.identity);
    if (occupied.size >= max)
      throw new AdmissionError("room_full", `A sala está cheia (máximo de ${max} pessoas).`);
    await tx
      .insert(roomSessionMembers)
      .values({
        sessionId: session.id,
        identity: grant.identity,
        userId: guest ? null : grant.identity,
        reservedUntil: new Date(now.getTime() + ADMISSION_LEASE_MS),
      })
      .onConflictDoUpdate({
        target: [roomSessionMembers.sessionId, roomSessionMembers.identity],
        set: { reservedUntil: new Date(now.getTime() + ADMISSION_LEASE_MS) },
      });
    return {
      sessionId: session.id,
      mediaRoomName: session.mediaRoomName,
      canShare: mayShareScreen(
        grant.identity,
        session.hostUserId,
        session.sharePolicy,
        session.allowedSharers,
      ),
    };
  });
}
