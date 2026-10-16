import { afterAll, beforeEach, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, getDb } from "@/server/db/index.server";
import { users } from "@/server/db/schema/user-auth";
import { membership } from "@/features/team/server/access.server";
import { teamChange, teamFixture } from "./support/workspaces";
import { account, mockControlTransport } from "./support/host-controls";

/** Managers handle members; who manages the team (managers) is the owner's call. */
process.env.ROOM_HOST_CONTROLS_ENABLED = "true";
beforeEach(mockControlTransport);
afterAll(closeDb);

async function emailOf(userId: string) {
  const [user] = await getDb().select().from(users).where(eq(users.id, userId));
  if (!user) throw new Error("Account missing");
  return user.email;
}

async function join(teamId: string, owner: string, userId: string, role: "manager" | "member") {
  const invited = await teamChange(owner, {
    kind: "invite",
    teamId,
    email: await emailOf(userId),
    role,
  });
  const token = invited.invitationLink?.split("/").at(-1);
  if (!token) throw new Error("Invitation missing");
  await teamChange(userId, { kind: "accept", token });
}

test("a manager invites and removes members, but neither invites nor removes managers", async () => {
  const team = await teamFixture();
  const manager = await account();
  const otherManager = await account();
  const member = await account();
  await join(team.teamId, team.actor, manager, "manager");
  await join(team.teamId, team.actor, otherManager, "manager");
  await join(team.teamId, team.actor, member, "member");

  const newcomer = await account();
  await expect(
    teamChange(manager, {
      kind: "invite",
      teamId: team.teamId,
      email: await emailOf(newcomer),
      role: "manager",
    }),
  ).rejects.toThrow("Só o dono");
  await expect(
    teamChange(manager, { kind: "remove", teamId: team.teamId, userId: otherManager }),
  ).rejects.toThrow("Só o dono");
  expect((await membership(getDb(), team.teamId, otherManager))?.role).toBe("manager");

  await expect(
    teamChange(manager, {
      kind: "invite",
      teamId: team.teamId,
      email: await emailOf(newcomer),
      role: "member",
    }),
  ).resolves.toMatchObject({ teamId: team.teamId });
  await teamChange(manager, { kind: "remove", teamId: team.teamId, userId: member });
  expect(await membership(getDb(), team.teamId, member)).toBeUndefined();
});
