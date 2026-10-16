import { ParticipantInfo } from "livekit-server-sdk";
import { vi } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db/index.server";
import { roomDefinitions, roomSessionMembers, roomSessions } from "@/server/db/schema/room-control";
import { users } from "@/server/db/schema/user-auth";
import { controlGateway } from "@/features/room/server/control-gateway.server";
import { reserveAdmission } from "@/features/room/server/session-admission.server";
import { executeHostCommand } from "@/features/room/server/host-command.server";
import { createAuditRecorder } from "@/server/audit.server";
import type { HostIntent } from "@/features/room/domain/host-controls";

export const online = new Map<string, ParticipantInfo[]>();
export function mockControlTransport() {
  online.clear();
  vi.spyOn(controlGateway, "participants").mockImplementation(
    async (room) => online.get(room) ?? [],
  );
  vi.spyOn(controlGateway, "sync").mockResolvedValue();
  vi.spyOn(controlGateway, "close").mockResolvedValue();
  vi.spyOn(controlGateway, "remove").mockResolvedValue();
}

export async function account() {
  const [person] = await getDb()
    .insert(users)
    .values({ name: "Pessoa", email: `${crypto.randomUUID()}@example.com`, emailVerified: true })
    .returning();
  if (!person) throw new Error("Account not saved");
  return person.id;
}
export function grant(room: string, identity: string) {
  return { room, identity, name: "Pessoa" };
}
export function participant(identity: string, joinedAt = 1) {
  return new ParticipantInfo({ identity, joinedAt: BigInt(joinedAt) });
}

export async function controlledRoom() {
  const db = getDb();
  const host = await account();
  const other = await account();
  const code = `host-${crypto.randomUUID().slice(0, 8)}`;
  // A room exists before anyone is admitted (createRoom in the app); admission never makes one.
  await db.insert(roomDefinitions).values({ code, ownerUserId: host });
  const admission = await reserveAdmission(db, grant(code, host), 6);
  await reserveAdmission(db, grant(code, other), 6);
  await db
    .update(roomSessionMembers)
    .set({ admittedAt: new Date() })
    .where(eq(roomSessionMembers.sessionId, admission.sessionId));
  online.set(admission.mediaRoomName, [participant(host), participant(other, 2)]);
  await db
    .update(roomSessions)
    .set({ status: "active" })
    .where(eq(roomSessions.id, admission.sessionId));
  const command = (input: HostIntent, actor = host) =>
    executeHostCommand(
      db,
      actor,
      { ...input, room: code, sessionId: admission.sessionId },
      createAuditRecorder({ userId: actor }),
    );
  return { host, other, code, ...admission, command };
}
