import { eq } from "drizzle-orm";
import { getDb } from "@/server/db/index.server";
import { roomSessions, roomSessionMembers, roomDefinitions } from "@/server/db/schema/room-control";
import { createAuditRecorder } from "@/server/audit.server";
import { provisionBeta } from "@/features/admin/beta/server/provision.server";
import { mutateWorkspaceRoom } from "@/features/rooms/server/room-mutations.server";
import { mutateTeam } from "@/features/team/server/team-mutations.server";
import type { TeamCommand } from "@/features/team/domain/commands";
import type { RoomWorkspaceCommand } from "@/features/rooms/domain/commands";
import { reserveAdmission } from "@/features/room/server/session-admission.server";
import { executeHostCommand } from "@/features/room/server/host-command.server";
import { account, grant, online, participant } from "./host-controls";
import type { HostIntent } from "@/features/room/domain/host-controls";

export const roomChange = (actor: string, input: RoomWorkspaceCommand) =>
  mutateWorkspaceRoom(getDb(), actor, input, createAuditRecorder({ userId: actor }));
export const teamChange = (actor: string, input: TeamCommand) =>
  mutateTeam(getDb(), actor, input, createAuditRecorder({ userId: actor }));
export async function beta(
  id: string,
  subject: "account" | "team" = "account",
  active = true,
  roomLimit = 3,
) {
  await provisionBeta(
    getDb(),
    { id, subject, active, roomLimit, expiresAt: null, reason: "Integration pilot fixture" },
    createAuditRecorder("system"),
  );
}
export async function personalRoom(owner?: string) {
  const actor = owner ?? (await account());
  await beta(actor);
  const created = await roomChange(actor, {
    kind: "create",
    name: "Personal workspace",
    allowGuests: true,
    memberCanHost: false,
  });
  const [room] = await getDb()
    .select()
    .from(roomDefinitions)
    .where(eq(roomDefinitions.id, created.roomId));
  if (!room) throw new Error("Room not saved");
  return { actor, room };
}
export async function teamFixture() {
  const actor = await account();
  await beta(actor);
  const { teamId } = await teamChange(actor, { kind: "create", name: "Team workspace" });
  await beta(teamId, "team");
  const created = await roomChange(actor, {
    kind: "create",
    teamId,
    name: "Team room",
    allowGuests: false,
    memberCanHost: false,
  });
  return { actor, teamId, ...created };
}
export async function liveCall(code: string, actor: string, others: string[] = []) {
  const admission = await reserveAdmission(getDb(), grant(code, actor), 6);
  for (const identity of others) await reserveAdmission(getDb(), grant(code, identity), 6);
  await getDb()
    .update(roomSessionMembers)
    .set({ admittedAt: new Date() })
    .where(eq(roomSessionMembers.sessionId, admission.sessionId));
  await getDb()
    .update(roomSessions)
    .set({ status: "active", startedAt: new Date(), participantCount: others.length + 1 })
    .where(eq(roomSessions.id, admission.sessionId));
  online.set(
    admission.mediaRoomName,
    [actor, ...others].map((id, index) => participant(id, index + 1)),
  );
  const command = (input: HostIntent, identity = actor) =>
    executeHostCommand(
      getDb(),
      identity,
      { ...input, room: code, sessionId: admission.sessionId },
      createAuditRecorder({ userId: identity }),
    );
  return { ...admission, command };
}
