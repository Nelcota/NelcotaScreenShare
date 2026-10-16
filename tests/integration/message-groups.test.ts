import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, describe, expect, test, vi } from "vitest";
import * as schema from "@/server/db/schema";
import { auditLogs, conversations } from "@/server/db/schema";
import { verifiedParticipant } from "./support/accounts";

/** Group operations as each account: the session comes from the request cookies. */
const requestHeaders = { current: new Headers() };
vi.mock("@/server/request-context.server", () => ({
  requestMemo: (load: () => unknown) => load,
  requestHeaders: () => requestHeaders.current,
}));

const friends = await import("@/features/friends/actions.server");
const chat = await import("@/features/messages/actions.server");
const { anonymizeParticipant } =
  await import("@/features/account/server/participant-accounts.server");
const { getUserAuth } = await import("@/features/auth/server/participant-auth.server");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
afterAll(() => pool.end());
const handler = (request: Request) => getUserAuth().handler(request);

type Person = Awaited<ReturnType<typeof verifiedParticipant>>;

function as(person: Person) {
  requestHeaders.current = new Headers({ cookie: person.jar.header(), "user-agent": "vitest" });
}

async function befriend(one: Person, other: Person) {
  as(one);
  await friends.sendFriendRequest({ userId: other.id });
  as(other);
  await friends.sendFriendRequest({ userId: one.id });
}

/** Ana is friends with Bia and Caio; Bia and Caio do not know each other. */
async function threeFriends() {
  const ana = await verifiedParticipant(db, handler, { name: "Ana" });
  const bia = await verifiedParticipant(db, handler, { name: "Bia" });
  const caio = await verifiedParticipant(db, handler, { name: "Caio" });
  await befriend(ana, bia);
  await befriend(ana, caio);
  return { ana, bia, caio };
}

async function groupOf(creator: Person, members: Person[], name?: string) {
  as(creator);
  const created = await chat.createGroupConversation({
    memberIds: members.map((member) => member.id),
    name,
  });
  assert(created.data, created.serverError ?? "group not created");
  return created.data.conversationId;
}

describe("message groups", () => {
  test("the creator's friends join, and members talk even if they are not friends", async () => {
    const { ana, bia, caio } = await threeFriends();
    const conversationId = await groupOf(ana, [bia, caio], "  Noite do filme ");
    const [stored] = await db
      .select({ name: conversations.name, kind: conversations.kind })
      .from(conversations)
      .where(eq(conversations.id, conversationId));
    expect(stored).toEqual({ name: "Noite do filme", kind: "group" });

    as(bia);
    await chat.sendMessage({ conversationId, body: "oi, Caio" });
    as(caio);
    const listed = await chat.listConversations({});
    expect(listed.data?.conversations[0]).toMatchObject({
      id: conversationId,
      others: [
        { id: ana.id, name: "Ana" },
        { id: bia.id, name: "Bia" },
      ],
      unread: 1,
    });

    const [audit] = await db
      .select({ action: auditLogs.action })
      .from(auditLogs)
      .where(eq(auditLogs.resourceId, conversationId));
    expect(audit).toEqual({ action: "conversation.group_create" });
  });

  test("only friends can be invited, two at least and nine at most", async () => {
    const { ana, bia } = await threeFriends();
    const stranger = await verifiedParticipant(db, handler, { name: "Duda" });
    as(ana);
    expect(await chat.createGroupConversation({ memberIds: [bia.id, stranger.id] })).toEqual({
      serverError: "Escolha só amigos.",
    });
    expect(await chat.createGroupConversation({ memberIds: [bia.id, bia.id] })).toEqual({
      serverError: "Escolha pelo menos dois amigos.",
    });
    const tooMany = Array.from({ length: 10 }, () => randomUUID());
    expect(await chat.createGroupConversation({ memberIds: tooMany })).toEqual({
      serverError: "Um grupo tem até 10 pessoas.",
    });
  });

  test("a group never puts together two people where one blocked the other", async () => {
    const { ana, bia, caio } = await threeFriends();
    as(caio);
    await friends.blockUser({ userId: bia.id });
    as(ana);
    const created = await chat.createGroupConversation({ memberIds: [bia.id, caio.id] });
    expect(created).toEqual({ serverError: "Não dá para criar esse grupo." });
  });

  test("in a group from before the block, the blocker stops seeing who they blocked", async () => {
    const { ana, bia, caio } = await threeFriends();
    const conversationId = await groupOf(ana, [bia, caio]);
    as(caio);
    await friends.blockUser({ userId: bia.id });
    as(bia);
    await chat.sendMessage({ conversationId, body: "ainda estou aqui" });
    as(ana);
    await chat.sendMessage({ conversationId, body: "oi" });

    as(caio);
    const page = await chat.listMessages({ conversationId });
    expect(page.data?.messages.map((message) => message.body)).toEqual(["oi"]);
    const listed = await chat.listConversations({});
    const group = listed.data?.conversations.find((item) => item.id === conversationId);
    expect(group).toMatchObject({ unread: 1, lastMessage: { body: "oi" } });
    as(ana);
    const everything = await chat.listMessages({ conversationId });
    expect(everything.data?.messages).toHaveLength(2);
  });

  test("whoever leaves stops seeing it, and the last one out deletes it", async () => {
    const { ana, bia, caio } = await threeFriends();
    const conversationId = await groupOf(ana, [bia, caio]);
    for (const person of [ana, bia]) {
      as(person);
      expect(await chat.leaveGroup({ conversationId })).toEqual({ data: { left: true } });
      expect(await chat.listMessages({ conversationId })).toEqual({
        serverError: "Conversa não encontrada.",
      });
    }
    as(caio);
    await chat.leaveGroup({ conversationId });
    expect(
      await db.select().from(conversations).where(eq(conversations.id, conversationId)),
    ).toEqual([]);
  });

  test("a direct conversation cannot be left like a group", async () => {
    const { ana, bia } = await threeFriends();
    as(ana);
    const opened = await chat.openDirectConversation({ userId: bia.id });
    assert(opened.data);
    expect(await chat.leaveGroup({ conversationId: opened.data.conversationId })).toEqual({
      serverError: "Conversa não encontrada.",
    });
  });

  test("a deleted account leaves its groups, and an empty group goes away", async () => {
    const { ana, bia, caio } = await threeFriends();
    const conversationId = await groupOf(ana, [bia, caio]);
    as(bia);
    await chat.leaveGroup({ conversationId });
    as(caio);
    await chat.leaveGroup({ conversationId });
    await db.transaction((tx) => anonymizeParticipant(tx, ana.id));
    expect(
      await db.select().from(conversations).where(eq(conversations.id, conversationId)),
    ).toEqual([]);
  });
});
