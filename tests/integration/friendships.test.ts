import assert from "node:assert/strict";
import { and, eq, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, describe, expect, test, vi } from "vitest";
import * as schema from "@/server/db/schema";
import { auditLogs, friendCodes, friendships, userBlocks, users } from "@/server/db/schema";
import { verifiedParticipant } from "./support/accounts";

/** Friend operations as each account: the session comes from the request cookies. */
const requestHeaders = { current: new Headers() };
vi.mock("@/server/request-context.server", () => ({
  requestMemo: (load: () => unknown) => load,
  requestHeaders: () => requestHeaders.current,
}));

const friends = await import("@/features/friends/actions.server");
const lists = await import("@/features/friends/server/friend-list.server");
const { requestFriendship } = await import("@/features/friends/server/request-friendship.server");
const { friendCode } = await import("@/features/friends/server/friend-codes.server");
const { anonymizeParticipant } =
  await import("@/features/account/server/participant-accounts.server");
const { personalData } = await import("@/features/account/server/personal-data.server");
const { getUserAuth } = await import("@/features/auth/server/participant-auth.server");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
afterAll(() => pool.end());
const handler = (request: Request) => getUserAuth().handler(request);

type Person = Awaited<ReturnType<typeof verifiedParticipant>>;

function as(person: Person) {
  requestHeaders.current = new Headers({ cookie: person.jar.header(), "user-agent": "vitest" });
}

async function rowBetween(one: Person, other: Person) {
  const [row] = await db
    .select()
    .from(friendships)
    .where(
      or(
        and(eq(friendships.userLowId, one.id), eq(friendships.userHighId, other.id)),
        and(eq(friendships.userLowId, other.id), eq(friendships.userHighId, one.id)),
      ),
    );
  return row;
}

async function pair() {
  const ana = await verifiedParticipant(db, handler, { name: "Ana" });
  const bia = await verifiedParticipant(db, handler, { name: "Bia" });
  return { ana, bia };
}

describe("friendships", () => {
  test("a request waits until the other person accepts it", async () => {
    const { ana, bia } = await pair();
    as(ana);
    expect(await friends.sendFriendRequest({ userId: bia.id })).toEqual({
      data: { status: "sent" },
    });
    expect(await rowBetween(ana, bia)).toMatchObject({ status: "pending", requestedBy: ana.id });
    expect((await friends.answerFriendRequest({ userId: bia.id, accept: true })).serverError).toBe(
      "Não foi possível agora. Atualize a página.",
    );

    as(bia);
    expect(await friends.answerFriendRequest({ userId: ana.id, accept: true })).toEqual({
      data: { status: "friends" },
    });
    const row = await rowBetween(ana, bia);
    expect(row?.status).toBe("accepted");
    expect(row?.acceptedAt).toBeInstanceOf(Date);

    const audit = await db.select().from(auditLogs).where(eq(auditLogs.actorUserId, bia.id));
    expect(audit.map((entry) => entry.action)).toContain("friend.accept");
  });

  test("crossed requests become a friendship, and repeating one is harmless", async () => {
    const { ana, bia } = await pair();
    as(ana);
    await friends.sendFriendRequest({ userId: bia.id });
    expect(await friends.sendFriendRequest({ userId: bia.id })).toEqual({
      data: { status: "sent" },
    });
    as(bia);
    expect(await friends.sendFriendRequest({ userId: ana.id })).toEqual({
      data: { status: "friends" },
    });
    expect((await rowBetween(ana, bia))?.status).toBe("accepted");
  });

  test("declining is quiet: the sender still sees the request, the receiver no longer does", async () => {
    const { ana, bia } = await pair();
    as(ana);
    await friends.sendFriendRequest({ userId: bia.id });
    as(bia);
    expect(await friends.answerFriendRequest({ userId: ana.id, accept: false })).toEqual({
      data: { status: "declined" },
    });
    expect(await lists.relationTo(db, ana.id, bia.id)).toBe("sent");
    expect(await lists.relationTo(db, bia.id, ana.id)).toBe("none");
    expect((await lists.friendLists(db, bia.id)).received).toEqual([]);
    expect(await lists.pendingReceivedCount(db, bia.id)).toBe(0);
    // The same request cannot reach her again right away.
    as(ana);
    expect(await friends.sendFriendRequest({ userId: bia.id })).toEqual({
      data: { status: "sent" },
    });
    expect((await lists.friendLists(db, bia.id)).received).toEqual([]);
    as(bia);
    expect(
      (await friends.answerFriendRequest({ userId: ana.id, accept: true })).serverError,
    ).toBeDefined();
  });

  test("counts leave out accounts blocked by the admin, as the lists do", async () => {
    const { ana, bia } = await pair();
    as(bia);
    await friends.sendFriendRequest({ userId: ana.id });
    expect(await lists.pendingReceivedCount(db, ana.id)).toBe(1);
    await db.update(users).set({ blockedAt: new Date() }).where(eq(users.id, bia.id));
    expect(await lists.pendingReceivedCount(db, ana.id)).toBe(0);
    expect((await lists.friendLists(db, ana.id)).received).toEqual([]);
  });

  test("two crossed requests at the same time end as friends, not as one lost request", async () => {
    const { ana, bia } = await pair();
    const outcomes = await Promise.all([
      db.transaction((tx) => requestFriendship(tx, ana.id, bia.id)),
      db.transaction((tx) => requestFriendship(tx, bia.id, ana.id)),
    ]);
    expect(outcomes.toSorted()).toEqual(["accept", "create"]);
    expect((await rowBetween(ana, bia))?.status).toBe("accepted");
  });

  test("cancelling and removing leave no row", async () => {
    const { ana, bia } = await pair();
    as(ana);
    await friends.sendFriendRequest({ userId: bia.id });
    expect(await friends.cancelFriendRequest({ userId: bia.id })).toEqual({
      data: { status: "none" },
    });
    expect(await rowBetween(ana, bia)).toBeUndefined();

    await friends.sendFriendRequest({ userId: bia.id });
    as(bia);
    await friends.answerFriendRequest({ userId: ana.id, accept: true });
    expect(await friends.removeFriend({ userId: ana.id })).toEqual({ data: { status: "none" } });
    expect(await rowBetween(ana, bia)).toBeUndefined();
    expect((await friends.removeFriend({ userId: ana.id })).serverError).toBeDefined();
  });

  test("a block ends the friendship and hides itself from the blocked person", async () => {
    const { ana, bia } = await pair();
    as(ana);
    await friends.sendFriendRequest({ userId: bia.id });
    as(bia);
    await friends.answerFriendRequest({ userId: ana.id, accept: true });
    expect(await friends.blockUser({ userId: ana.id })).toEqual({ data: { status: "blocked" } });
    expect(await rowBetween(ana, bia)).toBeUndefined();

    // Ana asks again: to her it is an ordinary request; Bia never sees it.
    as(ana);
    expect(await friends.sendFriendRequest({ userId: bia.id })).toEqual({
      data: { status: "sent" },
    });
    expect(await lists.relationTo(db, ana.id, bia.id)).toBe("sent");
    expect((await lists.friendLists(db, ana.id)).sent.map((person) => person.id)).toEqual([bia.id]);
    expect((await lists.friendLists(db, bia.id)).received).toEqual([]);

    as(bia);
    expect(await friends.unblockUser({ userId: ana.id })).toEqual({ data: { status: "none" } });
    expect((await friends.unblockUser({ userId: ana.id })).serverError).toBeDefined();
    expect((await lists.friendLists(db, bia.id)).received).toEqual([]);
  });

  test("a request the blocked person had sent stays on their side as sent", async () => {
    const { ana, bia } = await pair();
    as(ana);
    await friends.sendFriendRequest({ userId: bia.id });
    as(bia);
    await friends.blockUser({ userId: ana.id });
    expect(await lists.relationTo(db, ana.id, bia.id)).toBe("sent");
    expect(await lists.relationTo(db, bia.id, ana.id)).toBe("blocked");
  });

  test("oneself, an unknown account and invalid input are refused", async () => {
    const { ana } = await pair();
    as(ana);
    expect((await friends.sendFriendRequest({ userId: ana.id })).serverError).toBe("Esse é você.");
    expect(
      (await friends.sendFriendRequest({ userId: "0199c6f0-0000-7000-8000-0000000000ff" }))
        .serverError,
    ).toBe("Não foi possível agora. Atualize a página.");
    const invalid = await friends.sendFriendRequest({ userId: "nao-e-uuid" });
    expect(invalid.validationErrors).toBeDefined();
  });

  test("the data export lists friendships and blocks, and account deletion forgets them", async () => {
    const { ana, bia } = await pair();
    const caio = await verifiedParticipant(db, handler, { name: "Caio" });
    as(ana);
    await friends.sendFriendRequest({ userId: bia.id });
    await friends.blockUser({ userId: caio.id });

    await friendCode(db, ana.id);
    const exported = await personalData(db, ana.id);
    expect(exported.amizades).toEqual([
      expect.objectContaining({ pessoa: "Bia", situacao: "pending", pedidoFeitoPorVoce: true }),
    ]);
    expect(exported.pessoas_bloqueadas).toEqual([expect.objectContaining({ pessoa: "Caio" })]);
    expect(exported.codigo_de_amigo?.codigo).toMatch(/^[2-9A-HJKMNP-Z]{4}$/);

    await db.transaction((tx) => anonymizeParticipant(tx, ana.id));
    expect(await rowBetween(ana, bia)).toBeUndefined();
    const blocks = await db.select().from(userBlocks).where(eq(userBlocks.blockerId, ana.id));
    assert.equal(blocks.length, 0);
    // The anonymized row stays, so the cascade does not fire: the code must go explicitly.
    const codes = await db.select().from(friendCodes).where(eq(friendCodes.userId, ana.id));
    assert.equal(codes.length, 0);
  });
});
