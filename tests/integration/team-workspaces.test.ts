import { afterAll, beforeEach, expect, test, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { closeDb, getDb } from "@/server/db/index.server";
import { users } from "@/server/db/schema/user-auth";
import { teams, teamMembers, teamInvitations } from "@/server/db/schema/workspaces";
import { roomDefinitions, roomSessionMembers, roomSessions } from "@/server/db/schema/room-control";
import { membership } from "@/features/team/server/access.server";
import { teamWorkspace } from "@/features/team/server/queries.server";
import { sessionHistory } from "@/features/rooms/server/queries.server";
import { assertDefinitionAdmission } from "@/features/rooms/server/room-access.server";
import { readControlState } from "@/features/room/server/control-state.server";
import { reserveAdmission } from "@/features/room/server/session-admission.server";
import { authorizeSignal } from "@/features/room/server/signal-admission.server";
import { liveKitGateway } from "@/features/room/server/livekit-gateway.server";
import { controlGateway } from "@/features/room/server/control-gateway.server";
import { anonymizeParticipant } from "@/features/account/server/participant-accounts.server";
import { personalData } from "@/features/account/server/personal-data.server";
import { purgeTeamInvitations } from "@/features/team/server/retention.server";
import {
  teamFixture,
  teamChange,
  roomChange,
  beta,
  liveCall,
  personalRoom,
} from "./support/workspaces";
import { account, grant, mockControlTransport } from "./support/host-controls";

process.env.ROOM_HOST_CONTROLS_ENABLED = "true";
beforeEach(mockControlTransport);
afterAll(closeDb);

async function invite(
  teamId: string,
  actor: string,
  recipient: string,
  role: "member" | "manager" = "member",
) {
  const [user] = await getDb().select().from(users).where(eq(users.id, recipient));
  if (!user) throw new Error("Recipient missing");
  const result = await teamChange(actor, { kind: "invite", teamId, email: user.email, role });
  const token = result.invitationLink?.split("/").at(-1);
  if (!token) throw new Error("Invitation missing");
  return token;
}
test("invitations are hashed, email-bound, verified and redeemed exactly once under concurrency", async () => {
  const team = await teamFixture();
  const recipient = await account();
  const token = await invite(team.teamId, team.actor, recipient);
  const [stored] = await getDb()
    .select()
    .from(teamInvitations)
    .where(eq(teamInvitations.teamId, team.teamId));
  expect(stored?.tokenHash).not.toContain(token);
  expect(token).toHaveLength(43);
  await expect(teamChange(team.actor, { kind: "accept", token })).rejects.toThrow(
    "Convite indisponível",
  );
  await getDb().update(users).set({ emailVerified: false }).where(eq(users.id, recipient));
  await expect(teamChange(recipient, { kind: "accept", token })).rejects.toThrow(
    "Confirme o e-mail",
  );
  await getDb().update(users).set({ emailVerified: true }).where(eq(users.id, recipient));
  const results = await Promise.allSettled([
    teamChange(recipient, { kind: "accept", token }),
    teamChange(recipient, { kind: "accept", token }),
  ]);
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  expect((await membership(getDb(), team.teamId, recipient))?.role).toBe("member");
});
test("revoked, expired and inactive-Pro invites cannot grant membership", async () => {
  const team = await teamFixture();
  const recipient = await account();
  const token = await invite(team.teamId, team.actor, recipient);
  const [stored] = await getDb()
    .select()
    .from(teamInvitations)
    .where(eq(teamInvitations.teamId, team.teamId));
  if (!stored) throw new Error("Invitation missing");
  await teamChange(team.actor, { kind: "revoke", teamId: team.teamId, invitationId: stored.id });
  await expect(teamChange(recipient, { kind: "accept", token })).rejects.toThrow(
    "Convite indisponível",
  );
  const expired = await invite(team.teamId, team.actor, recipient);
  await getDb()
    .update(teamInvitations)
    .set({ expiresAt: new Date(0) })
    .where(eq(teamInvitations.teamId, team.teamId));
  await expect(teamChange(recipient, { kind: "accept", token: expired })).rejects.toThrow(
    "Convite indisponível",
  );
  const inactive = await invite(team.teamId, team.actor, recipient);
  await beta(team.teamId, "team", false);
  await expect(teamChange(recipient, { kind: "accept", token: inactive })).rejects.toThrow(
    "Pro beta ativo",
  );
  await expect(
    teamChange(team.actor, {
      kind: "invite",
      teamId: team.teamId,
      email: "other@example.com",
      role: "member",
    }),
  ).rejects.toThrow("Pro beta ativo");
});
test("tenant scoping, roles, host eligibility and the last-owner invariant hold", async () => {
  const first = await teamFixture();
  const second = await teamFixture();
  const manager = await account();
  const member = await account();
  for (const [id, role] of [
    [manager, "manager"],
    [member, "member"],
  ] as const)
    await teamChange(id, {
      kind: "accept",
      token: await invite(first.teamId, first.actor, id, role),
    });
  await expect(teamWorkspace(getDb(), second.teamId, member)).rejects.toThrow(
    "não está disponível",
  );
  await expect(sessionHistory(getDb(), member, second.roomId)).rejects.toThrow(
    "não está disponível",
  );
  await expect(
    roomChange(member, {
      kind: "edit",
      roomId: first.roomId,
      name: "Forged",
      allowGuests: true,
      memberCanHost: true,
    }),
  ).rejects.toThrow("não está disponível");
  await expect(
    teamChange(manager, { kind: "role", teamId: first.teamId, userId: member, role: "manager" }),
  ).rejects.toThrow("Só o dono");
  await expect(
    teamChange(manager, { kind: "remove", teamId: first.teamId, userId: first.actor }),
  ).rejects.toThrow("dono precisa");
  await expect(reserveAdmission(getDb(), grant(first.code, member), 6)).rejects.toThrow(
    "Só donos e gestores",
  );
  const call = await liveCall(first.code, first.actor, [manager, member]);
  await expect(call.command({ kind: "transfer", identity: member })).rejects.toThrow(
    "não pode ser anfitriã",
  );
  await roomChange(manager, {
    kind: "edit",
    roomId: first.roomId,
    name: "Members host",
    allowGuests: false,
    memberCanHost: true,
  });
  await call.command({ kind: "transfer", identity: member });
  await expect(call.command({ kind: "lock", locked: true })).rejects.toThrow("Só o anfitrião");
  await expect(
    getDb()
      .delete(teamMembers)
      .where(and(eq(teamMembers.teamId, first.teamId), eq(teamMembers.userId, first.actor))),
  ).rejects.toThrow();
  await teamChange(first.actor, { kind: "transfer", teamId: first.teamId, userId: manager });
  expect((await membership(getDb(), first.teamId, manager))?.role).toBe("owner");
  expect((await membership(getDb(), first.teamId, first.actor))?.role).toBe("manager");
});
test("membership loss revokes cached credentials despite a failed media command", async () => {
  const team = await teamFixture();
  const member = await account();
  await teamChange(member, {
    kind: "accept",
    token: await invite(team.teamId, team.actor, member),
  });
  const call = await liveCall(team.code, team.actor, [member]);
  const credential = await liveKitGateway.signToken(grant(call.mediaRoomName, member));
  vi.spyOn(controlGateway, "remove").mockRejectedValueOnce(
    new Error("Transport temporarily offline"),
  );
  const result = await teamChange(team.actor, {
    kind: "remove",
    teamId: team.teamId,
    userId: member,
  });
  expect(result.transportPending).toBe(true);
  await expect(authorizeSignal(getDb(), credential)).rejects.toMatchObject({
    code: "room_removed",
  });
  await expect(teamWorkspace(getDb(), team.teamId, member)).rejects.toThrow("não está disponível");
  const [admission] = await getDb()
    .select()
    .from(roomSessionMembers)
    .where(
      and(
        eq(roomSessionMembers.sessionId, call.sessionId),
        eq(roomSessionMembers.identity, member),
      ),
    );
  expect(admission?.excludedAt).toBeInstanceOf(Date);
});

test("guests follow the explicit link policy and role loss immediately revokes host authority", async () => {
  const team = await teamFixture();
  const manager = await account();
  await teamChange(manager, {
    kind: "accept",
    token: await invite(team.teamId, team.actor, manager, "manager"),
  });
  const call = await liveCall(team.code, team.actor, [manager]);
  await expect(reserveAdmission(getDb(), grant(team.code, "convidado-test"), 6)).rejects.toThrow(
    "restrita aos membros",
  );
  await roomChange(team.actor, {
    kind: "edit",
    roomId: team.roomId,
    name: "Guest link",
    allowGuests: true,
    memberCanHost: false,
  });
  const [room] = await getDb()
    .select()
    .from(roomDefinitions)
    .where(eq(roomDefinitions.id, team.roomId));
  if (!room) throw new Error("Room missing");
  await expect(
    assertDefinitionAdmission(getDb(), room, "convidado-test", false),
  ).resolves.toBeUndefined();
  await expect(assertDefinitionAdmission(getDb(), room, "convidado-test", true)).rejects.toThrow(
    "restrita aos membros",
  );
  await call.command({ kind: "transfer", identity: manager });
  await teamChange(team.actor, {
    kind: "role",
    teamId: team.teamId,
    userId: manager,
    role: "member",
  });
  expect((await readControlState(getDb(), team.code, call.sessionId, manager))?.isHost).toBe(false);
  expect((await readControlState(getDb(), team.code, call.sessionId, team.actor))?.isHost).toBe(
    true,
  );
  await expect(call.command({ kind: "close" }, manager)).rejects.toThrow("não pode moderar");
});
test("explicit account deletion preserves ownership until consent and redacts workspace data", async () => {
  const team = await teamFixture();
  const personal = await personalRoom(team.actor);
  await roomChange(team.actor, { kind: "favorite", roomId: personal.room.id, favorite: true });
  await invite(team.teamId, team.actor, await account());
  const exported = await personalData(getDb(), team.actor);
  expect(exported.times).toHaveLength(1);
  expect(exported.salas_favoritas).toHaveLength(1);
  expect(JSON.stringify(exported)).not.toContain("tokenHash");
  await expect(getDb().transaction((tx) => anonymizeParticipant(tx, team.actor))).rejects.toThrow(
    "Transfira a propriedade",
  );
  await getDb().transaction((tx) => anonymizeParticipant(tx, team.actor, true));
  const [deleted] = await getDb().select().from(teams).where(eq(teams.id, team.teamId));
  expect(deleted?.deletedAt).toBeInstanceOf(Date);
  expect(await membership(getDb(), team.teamId, team.actor)).toBeUndefined();
  const [room] = await getDb()
    .select()
    .from(roomDefinitions)
    .where(eq(roomDefinitions.id, personal.room.id));
  expect(room).toMatchObject({ ownerUserId: null });
  expect(room?.archivedAt).toBeInstanceOf(Date);
  await purgeTeamInvitations(getDb(), new Date(Date.now() + 60 * 86_400_000));
  expect(
    await getDb().select().from(teamInvitations).where(eq(teamInvitations.teamId, team.teamId)),
  ).toHaveLength(0);
  expect(
    await getDb()
      .select()
      .from(roomSessions)
      .where(eq(roomSessions.definitionId, personal.room.id)),
  ).toHaveLength(0);
});
