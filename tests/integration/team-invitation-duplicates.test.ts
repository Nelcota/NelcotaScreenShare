import { afterAll, beforeEach, expect, test } from "vitest";
import { and, eq, isNull } from "drizzle-orm";
import { closeDb, getDb } from "@/server/db/index.server";
import { users } from "@/server/db/schema/user-auth";
import { teamInvitations } from "@/server/db/schema/workspaces";
import { invitationForAccount } from "@/features/team/server/invitations.server";
import { teamChange, teamFixture } from "./support/workspaces";
import { account, mockControlTransport } from "./support/host-controls";

/** One valid link per e-mail: a new invite replaces the old one, and joining closes the rest. */
process.env.ROOM_HOST_CONTROLS_ENABLED = "true";
beforeEach(mockControlTransport);
afterAll(closeDb);

async function emailOf(userId: string) {
  const [user] = await getDb().select().from(users).where(eq(users.id, userId));
  if (!user) throw new Error("Account missing");
  return user.email;
}

function openInvitations(teamId: string) {
  return getDb()
    .select()
    .from(teamInvitations)
    .where(
      and(
        eq(teamInvitations.teamId, teamId),
        isNull(teamInvitations.usedAt),
        isNull(teamInvitations.revokedAt),
      ),
    );
}

async function invite(teamId: string, owner: string, email: string) {
  const invited = await teamChange(owner, { kind: "invite", teamId, email, role: "member" });
  const token = invited.invitationLink?.split("/").at(-1);
  if (!token) throw new Error("Invitation missing");
  return token;
}

test("a new invite for the same e-mail replaces the old link", async () => {
  const team = await teamFixture();
  const bia = await account();
  const email = await emailOf(bia);
  const first = await invite(team.teamId, team.actor, email);
  const second = await invite(team.teamId, team.actor, email.toUpperCase());

  await expect(invitationForAccount(getDb(), first, bia)).rejects.toThrow("Convite indisponível");
  await expect(invitationForAccount(getDb(), second, bia)).resolves.toBeDefined();
});

test("after joining, no other link for that person stays valid", async () => {
  const team = await teamFixture();
  const other = await teamFixture();
  const bia = await account();
  const email = await emailOf(bia);
  const token = await invite(team.teamId, team.actor, email);
  const otherTeam = await invite(other.teamId, other.actor, email);
  // An invite saved before the replacement existed (two links for the same e-mail).
  const [saved] = await openInvitations(team.teamId);
  if (!saved) throw new Error("Invitation missing");
  const { id: _id, ...copy } = saved;
  await getDb()
    .insert(teamInvitations)
    .values({ ...copy, tokenHash: `${saved.tokenHash}-velho` });
  expect(await openInvitations(team.teamId)).toHaveLength(2);

  await teamChange(bia, { kind: "accept", token });

  expect(await openInvitations(team.teamId)).toHaveLength(0);
  // Another team's invite is that team's business.
  await expect(invitationForAccount(getDb(), otherTeam, bia)).resolves.toBeDefined();
});
