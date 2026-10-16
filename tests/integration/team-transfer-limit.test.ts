import { afterAll, beforeEach, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, getDb } from "@/server/db/index.server";
import { users } from "@/server/db/schema/user-auth";
import { membership } from "@/features/team/server/access.server";
import { beta, teamChange } from "./support/workspaces";
import { account, mockControlTransport } from "./support/host-controls";

/** The pilot's 3 teams per owner also hold when a team is handed over, not only created. */
process.env.ROOM_HOST_CONTROLS_ENABLED = "true";
beforeEach(mockControlTransport);
afterAll(closeDb);

async function joinTeam(teamId: string, owner: string, member: string) {
  const [user] = await getDb().select().from(users).where(eq(users.id, member));
  if (!user) throw new Error("Member missing");
  const invited = await teamChange(owner, {
    kind: "invite",
    teamId,
    email: user.email,
    role: "member",
  });
  const token = invited.invitationLink?.split("/").at(-1);
  if (!token) throw new Error("Invitation missing");
  await teamChange(member, { kind: "accept", token });
}

test("an account that already owns 3 teams cannot be handed a fourth", async () => {
  const owner = await account();
  const receiver = await account();
  await beta(owner);
  await beta(receiver);
  for (const name of ["Um", "Dois", "Três"]) await teamChange(receiver, { kind: "create", name });
  const { teamId } = await teamChange(owner, { kind: "create", name: "Quarto" });
  if (!teamId) throw new Error("Team missing");
  await beta(teamId, "team");
  await joinTeam(teamId, owner, receiver);

  await expect(teamChange(owner, { kind: "transfer", teamId, userId: receiver })).rejects.toThrow(
    "até 3 times",
  );
  expect((await membership(getDb(), teamId, owner))?.role).toBe("owner");
  expect((await membership(getDb(), teamId, receiver))?.role).toBe("member");
});
