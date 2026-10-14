import type * as Crypto from "node:crypto";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, describe, expect, test, vi } from "vitest";
import * as schema from "@/server/db/schema";
import { verifiedParticipant } from "./support/accounts";

/** Friend codes and adding friends by code or e-mail. */
const requestHeaders = { current: new Headers() };
vi.mock("@/server/request-context.server", () => ({
  requestMemo: (load: () => unknown) => load,
  requestHeaders: () => requestHeaders.current,
}));

/** Lets a test choose the next codes drawn; the rest stay random. */
const forcedPicks: number[] = [];
vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof Crypto>();
  const randomInt = (max: number) => forcedPicks.shift() ?? actual.randomInt(max);
  return { ...actual, default: { ...actual, randomInt }, randomInt };
});

const { FRIEND_CODE_ALPHABET } = await import("@/features/friends/domain/friend-code");
const { MAX_PENDING_SENT, friendPair } = await import("@/features/friends/domain/friendship");
const { retiredFriendCodes } = await import("@/server/db/schema");
const { forgetFriendships } = await import("@/features/friends/server/friendships.server");

/** The next draws come out as these codes, in order. */
function forceDraws(...wanted: string[]) {
  for (const code of wanted) {
    for (const character of code) forcedPicks.push(FRIEND_CODE_ALPHABET.indexOf(character));
  }
}

const codes = await import("@/features/friends/code-actions.server");
const friends = await import("@/features/friends/actions.server");
const store = await import("@/features/friends/server/friend-codes.server");
const links = await import("@/features/friends/server/friend-links.server");
const lists = await import("@/features/friends/server/friend-list.server");
const { getUserAuth } = await import("@/features/auth/server/participant-auth.server");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
afterAll(() => pool.end());
const handler = (request: Request) => getUserAuth().handler(request);

type Person = Awaited<ReturnType<typeof verifiedParticipant>>;

function as(person: Person) {
  requestHeaders.current = new Headers({ cookie: person.jar.header(), "user-agent": "vitest" });
}

describe("friend code", () => {
  test("is created once, and a new one replaces the code and the link", async () => {
    const ana = await verifiedParticipant(db, handler, { name: "Ana" });
    const first = await store.friendCode(db, ana.id);
    expect(first).toMatch(/^[2-9A-HJKMNP-Z]{6}$/);
    expect(await store.friendCode(db, ana.id)).toBe(first);
    expect(await store.ownerOfFriendCode(db, first)).toBe(ana.id);
    const oldLink = await links.friendLinkToken(db, ana.id);

    as(ana);
    const rotated = await codes.newFriendCode(undefined);
    const shown = rotated.data?.code ?? "";
    expect(shown).toMatch(/^NELC-[2-9A-HJKMNP-Z]{6}$/);
    expect(await store.ownerOfFriendCode(db, shown.slice(5))).toBe(ana.id);
    expect(await links.ownerOfFriendLink(db, oldLink)).toBeNull();
  });
});

describe("retired friend codes", () => {
  test("an old code is never handed to someone else", async () => {
    const ana = await verifiedParticipant(db, handler, { name: "Ana" });
    const old = await store.friendCode(db, ana.id);
    await store.rotateFriendCode(db, ana.id);
    expect(await store.ownerOfFriendCode(db, old)).toBeNull();

    const bia = await verifiedParticipant(db, handler, { name: "Bia" });
    forceDraws(old);
    const biaCode = await store.friendCode(db, bia.id);
    expect(biaCode).not.toBe(old);
    expect(await store.ownerOfFriendCode(db, old)).toBeNull();
  });

  test("a deleted account's code is retired too", async () => {
    const caio = await verifiedParticipant(db, handler, { name: "Caio" });
    const code = await store.friendCode(db, caio.id);
    await forgetFriendships(db, caio.id);
    const retired = await db.select().from(retiredFriendCodes);
    expect(retired.map((row) => row.code)).toContain(code);
  });

  test("grows to seven characters when the six-character draws keep clashing", async () => {
    const dora = await verifiedParticipant(db, handler, { name: "Dora" });
    const taken = await store.friendCode(db, dora.id);
    const edu = await verifiedParticipant(db, handler, { name: "Edu" });
    forceDraws(taken, taken, taken);
    expect(await store.friendCode(db, edu.id)).toMatch(/^[2-9A-HJKMNP-Z]{7}$/);
    forcedPicks.length = 0;
  });
});

describe("old four-character codes", () => {
  test("keep working", async () => {
    const ana = await verifiedParticipant(db, handler, { name: "Ana" });
    const bia = await verifiedParticipant(db, handler, { name: "Bia" });
    const old = "4K7Q";
    await db.delete(schema.friendCodes).where(eq(schema.friendCodes.code, old));
    await db.insert(schema.friendCodes).values({ userId: bia.id, code: old }).onConflictDoNothing();
    as(ana);
    expect((await codes.addFriend({ target: "NELC-4K7Q" })).data).toEqual({ status: "sent" });
  });
});

describe("adding a friend", () => {
  test("tries count per network too, so several accounts do not add up", async () => {
    const people = await Promise.all(
      [0, 1, 2, 3].map((index) => verifiedParticipant(db, handler, { name: `Pessoa ${index}` })),
    );
    const tryFrom = (person: (typeof people)[number], index: number) => {
      requestHeaders.current = new Headers({
        cookie: person.jar.header(),
        "user-agent": "vitest",
        "x-client-ip": "203.0.113.77",
      });
      return codes.addFriend({ target: `ninguem-${index}@exemplo.com` });
    };
    for (let index = 0; index < 30; index++) {
      const person = people[Math.floor(index / 10)];
      if (!person) throw new Error("person");
      expect((await tryFrom(person, index)).data).toEqual({ status: "sent" });
    }
    const last = people[3];
    if (!last) throw new Error("person");
    expect((await tryFrom(last, 30)).serverError).toBe("Muitas tentativas. Espere alguns minutos.");
  });

  test("by code, typed in any case, sends the request", async () => {
    const ana = await verifiedParticipant(db, handler, { name: "Ana" });
    const bia = await verifiedParticipant(db, handler, { name: "Bia" });
    const code = await store.friendCode(db, bia.id);

    as(ana);
    const result = await codes.addFriend({ target: `nelc-${code.toLowerCase()}` });
    expect(result.data?.status).toBe("sent");
    expect(await lists.relationTo(db, ana.id, bia.id)).toBe("sent");
  });

  test("by e-mail, the answer is the same whether the account exists or not", async () => {
    const ana = await verifiedParticipant(db, handler, { name: "Ana" });
    const bia = await verifiedParticipant(db, handler, { name: "Bia" });

    as(ana);
    const known = await codes.addFriend({ target: bia.email.toUpperCase() });
    const unknown = await codes.addFriend({ target: "ninguem-aqui@exemplo.com" });
    expect(known.data).toEqual({ status: "sent" });
    expect(unknown.data).toEqual({ status: "sent" });
    expect((await lists.friendLists(db, ana.id)).sent).toEqual([]);
    expect(await lists.relationTo(db, ana.id, bia.id)).toBe("none");
    expect((await lists.friendLists(db, bia.id)).received).toEqual([{ id: ana.id, name: "Ana" }]);
    const { personalData } = await import("@/features/account/server/personal-data.server");
    expect((await personalData(db, ana.id)).amizades).toEqual([]);
    as(bia);
    expect(
      (await friends.answerFriendRequest({ userId: ana.id, accept: true })).data,
    ).toBeDefined();
    expect((await lists.friendLists(db, ana.id)).friends).toEqual([{ id: bia.id, name: "Bia" }]);
    expect(await lists.relationTo(db, ana.id, bia.id)).toBe("friends");
  });

  test("with too many requests waiting, existing and unknown e-mails get the same answer", async () => {
    const ana = await verifiedParticipant(db, handler, { name: "Ana" });
    const bia = await verifiedParticipant(db, handler, { name: "Bia" });
    const others = await db
      .insert(schema.users)
      .values(
        Array.from({ length: MAX_PENDING_SENT }, (_, index) => ({
          name: `Pessoa ${index}`,
          email: `pendente-${index}-${randomUUID()}@exemplo.test`,
        })),
      )
      .returning({ id: schema.users.id });
    await db.insert(schema.friendships).values(
      others.map(({ id }) => ({
        ...friendPair(ana.id, id),
        requestedBy: ana.id,
        status: "pending" as const,
      })),
    );

    as(ana);
    const known = await codes.addFriend({ target: bia.email });
    const unknown = await codes.addFriend({ target: "ninguem-aqui-tambem@exemplo.com" });
    expect(unknown).toEqual(known);
    expect(await lists.relationTo(db, ana.id, bia.id)).toBe("none");
  });

  test("accepts at once when the other person had already asked", async () => {
    const ana = await verifiedParticipant(db, handler, { name: "Ana" });
    const bia = await verifiedParticipant(db, handler, { name: "Bia" });
    as(bia);
    await friends.sendFriendRequest({ userId: ana.id });

    as(ana);
    const result = await codes.addFriend({ target: bia.email });
    expect(result.data?.status).toBe("friends");
  });

  test("a block reads as an ordinary sent request", async () => {
    const ana = await verifiedParticipant(db, handler, { name: "Ana" });
    const bia = await verifiedParticipant(db, handler, { name: "Bia" });
    as(bia);
    await friends.blockUser({ userId: ana.id });

    as(ana);
    const result = await codes.addFriend({ target: bia.email });
    expect(result.data?.status).toBe("sent");
    // Neither account can observe a private request hidden by a block.
    expect(await lists.relationTo(db, ana.id, bia.id)).toBe("none");
    expect((await lists.friendLists(db, bia.id)).received).toEqual([]);
  });

  test("says what is wrong with the typed value, and refuses yourself", async () => {
    const ana = await verifiedParticipant(db, handler, { name: "Ana" });
    as(ana);
    expect((await codes.addFriend({ target: "ana@" })).serverError).toBe("Confira o e-mail.");
    expect((await codes.addFriend({ target: "NELC-00" })).serverError).toContain(
      "Confira o código",
    );
    expect((await codes.addFriend({ target: "NELC-ZZZZZ" })).serverError).toBe(
      "Nenhuma conta com esse código.",
    );
    expect((await codes.addFriend({ target: ana.email })).serverError).toBe("Esse é você.");
  });

  test("stops after ten tries in a row", async () => {
    const ana = await verifiedParticipant(db, handler, { name: "Ana" });
    as(ana);
    const tries = Array.from({ length: 10 }, (_, index) => `teste${index}@exemplo.com`);
    for (const email of tries) await codes.addFriend({ target: email });
    const blocked = await codes.addFriend({ target: "mais-um@exemplo.com" });
    expect(blocked.serverError).toBe("Muitas tentativas. Espere alguns minutos.");
  });
});

test("private email quotas do not reveal registered addresses through public requests", async () => {
  const ana = await verifiedParticipant(db, handler, { name: "Ana" });
  const bia = await verifiedParticipant(db, handler, { name: "Bia" });
  const { MAX_PENDING_SENT, friendPair } = await import("@/features/friends/domain/friendship");
  const { countPendingSent } = await import("@/features/friends/server/friendships.server");
  const people = await db
    .insert(schema.users)
    .values(
      Array.from({ length: MAX_PENDING_SENT }, () => ({
        name: "Private recipient",
        email: `${crypto.randomUUID()}@example.com`,
      })),
    )
    .returning({ id: schema.users.id });
  await db.insert(schema.friendships).values(
    people.map((person) => ({
      ...friendPair(ana.id, person.id),
      requestedBy: ana.id,
      privateRequest: true,
    })),
  );
  as(ana);
  expect((await codes.addFriend({ target: bia.email })).data).toEqual({ status: "sent" });
  expect((await codes.addFriend({ target: "unknown-private@example.com" })).data).toEqual({
    status: "sent",
  });
  expect(await countPendingSent(db, ana.id)).toBe(0);
  expect((await lists.friendLists(db, ana.id)).sent).toEqual([]);
  expect((await friends.cancelFriendRequest({ userId: people[0]!.id })).data).toBeUndefined();
  expect((await friends.sendFriendRequest({ userId: bia.id })).data?.status).toBe("sent");
  expect((await lists.friendLists(db, ana.id)).sent).toEqual([{ id: bia.id, name: "Bia" }]);
});
