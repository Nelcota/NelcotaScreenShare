import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, describe, expect, test, vi } from "vitest";
import * as schema from "@/server/db/schema";
import { conversationMembers, gifFavorites, messages } from "@/server/db/schema";
import { verifiedParticipant } from "./support/accounts";

/** Message operations as each account: the session comes from the request cookies. */
const requestHeaders = { current: new Headers() };
vi.mock("@/server/request-context.server", () => ({
  requestMemo: (load: () => unknown) => load,
  requestHeaders: () => requestHeaders.current,
}));

const friends = await import("@/features/friends/actions.server");
const chat = await import("@/features/messages/actions.server");
const gifs = await import("@/features/messages/gif-actions.server");
const { anonymizeParticipant } =
  await import("@/features/account/server/participant-accounts.server");
const { personalData } = await import("@/features/account/server/personal-data.server");
const { liveBus } = await import("@/features/live/server/live-bus.server");
const { conversationPage } = await import("@/features/messages/server/conversation-page.server");
const { markOnline } = await import("@/features/friends/server/online-presence.server");
const { getUserAuth } = await import("@/features/auth/server/participant-auth.server");
const { unreadSummary, columnConversations } =
  await import("@/features/messages/server/conversation-list.server");

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
  expect(await friends.sendFriendRequest({ userId: one.id })).toEqual({
    data: { status: "friends" },
  });
}

async function friendsPair() {
  const ana = await verifiedParticipant(db, handler, { name: "Ana" });
  const bia = await verifiedParticipant(db, handler, { name: "Bia" });
  await befriend(ana, bia);
  return { ana, bia };
}

async function openWith(person: Person, other: Person) {
  as(person);
  const opened = await chat.openDirectConversation({ userId: other.id });
  assert(opened.data, opened.serverError ?? "conversation not opened");
  return opened.data.conversationId;
}

describe("direct messages", () => {
  test("friends talk, and the list shows the last message and what is unread", async () => {
    const { ana, bia } = await friendsPair();
    const conversationId = await openWith(ana, bia);
    expect(await openWith(bia, ana)).toBe(conversationId);

    as(ana);
    expect((await chat.sendMessage({ conversationId, body: "  bora hoje?  " })).data).toBeDefined();
    as(bia);
    const listed = await chat.listConversations({});
    assert(listed.data);
    expect(listed.data.conversations).toHaveLength(1);
    expect(listed.data.conversations[0]).toMatchObject({
      id: conversationId,
      kind: "direct",
      others: [{ id: ana.id, name: "Ana" }],
      lastMessage: { body: "bora hoje?", authorId: ana.id },
      unread: 1,
    });

    await chat.markConversationRead({ conversationId });
    const afterRead = await chat.listConversations({});
    expect(afterRead.data?.conversations[0]?.unread).toBe(0);
    const page = await chat.listMessages({ conversationId });
    expect(page.data?.messages.map((message) => message.body)).toEqual(["bora hoje?"]);
  });

  test("only friends can start or keep a conversation", async () => {
    const ana = await verifiedParticipant(db, handler, { name: "Ana" });
    const caio = await verifiedParticipant(db, handler, { name: "Caio" });
    as(ana);
    expect(await chat.openDirectConversation({ userId: caio.id })).toEqual({
      serverError: "Só dá para mandar mensagem para amigos.",
    });

    const bia = await verifiedParticipant(db, handler, { name: "Bia" });
    await befriend(ana, bia);
    const conversationId = await openWith(ana, bia);
    as(bia);
    await friends.removeFriend({ userId: ana.id });
    as(ana);
    expect(await chat.sendMessage({ conversationId, body: "oi?" })).toEqual({
      serverError: "Só dá para mandar mensagem para amigos.",
    });
  });

  test("a block stops new messages", async () => {
    const { ana, bia } = await friendsPair();
    const conversationId = await openWith(ana, bia);
    as(bia);
    await friends.blockUser({ userId: ana.id });
    as(ana);
    expect((await chat.sendMessage({ conversationId, body: "oi" })).serverError).toBeDefined();
  });

  test("a block or an unfriending hides the other's status in the old conversation", async () => {
    const { ana, bia } = await friendsPair();
    const conversationId = await openWith(ana, bia);
    markOnline(bia.id);
    expect((await conversationPage(db, ana.id, conversationId))?.conversation.status).toBe(
      "online",
    );
    as(bia);
    await friends.blockUser({ userId: ana.id });
    expect((await conversationPage(db, ana.id, conversationId))?.conversation.status).toBeNull();

    const { ana: caio, bia: davi } = await friendsPair();
    const kept = await openWith(caio, davi);
    markOnline(davi.id);
    as(davi);
    await friends.removeFriend({ userId: caio.id });
    expect((await conversationPage(db, caio.id, kept))?.conversation.status).toBeNull();
  });

  test("people outside the conversation cannot read or write in it", async () => {
    const { ana, bia } = await friendsPair();
    const conversationId = await openWith(ana, bia);
    const caio = await verifiedParticipant(db, handler, { name: "Caio" });
    as(caio);
    expect(await chat.listMessages({ conversationId })).toEqual({
      serverError: "Conversa não encontrada.",
    });
    expect(await chat.sendMessage({ conversationId, body: "oi" })).toEqual({
      serverError: "Conversa não encontrada.",
    });
  });

  test("blank text is refused and a GIF is stored by slug", async () => {
    const { ana, bia } = await friendsPair();
    const conversationId = await openWith(ana, bia);
    expect(await chat.sendMessage({ conversationId, body: "   " })).toEqual({
      serverError: "Escreva uma mensagem.",
    });
    expect(
      (await chat.sendMessage({ conversationId, gifSlug: "../etc/passwd" })).validationErrors,
    ).toBeDefined();
    await chat.sendMessage({ conversationId, gifSlug: "happy-dance-42" });
    const [stored] = await db
      .select({ body: messages.body, gifSlug: messages.gifSlug })
      .from(messages)
      .where(eq(messages.conversationId, conversationId));
    expect(stored).toEqual({ body: null, gifSlug: "happy-dance-42" });
  });

  test("each person deletes only their own messages", async () => {
    const { ana, bia } = await friendsPair();
    const conversationId = await openWith(ana, bia);
    const sent = await chat.sendMessage({ conversationId, body: "apaga isso" });
    assert(sent.data);
    as(bia);
    expect(await chat.deleteMessage({ messageId: sent.data.messageId })).toEqual({
      serverError: "Mensagem não encontrada.",
    });
    as(ana);
    expect(await chat.deleteMessage({ messageId: sent.data.messageId })).toEqual({
      data: { deleted: true },
    });
    const listed = await chat.listConversations({});
    expect(listed.data?.conversations[0]?.lastMessage).toBeNull();
  });
});

/** What the tab and the notifications see for this person. */
async function unreadOf(person: Person) {
  const summary = await unreadSummary(db, person.id);
  const column = await columnConversations(db, person.id);
  return { total: summary.total, latest: summary.latest?.body ?? null, column };
}

describe("unread after the friendship ends", () => {
  test("an ex-friend's messages stop counting and notifying, after unfriending or a block", async () => {
    for (const end of ["unfriend", "block"] as const) {
      const { ana, bia } = await friendsPair();
      const conversationId = await openWith(ana, bia);
      await chat.sendMessage({ conversationId, body: `antes de ${end}` });
      expect((await unreadOf(bia)).total).toBe(1);
      as(bia);
      if (end === "unfriend") await friends.removeFriend({ userId: ana.id });
      if (end === "block") await friends.blockUser({ userId: ana.id });
      const after = await unreadOf(bia);
      expect(after.total).toBe(0);
      expect(after.latest).toBeNull();
      expect(after.column.unreadByFriend[ana.id]).toBeUndefined();
    }
  });

  test("a group still counts a member who is no longer a friend", async () => {
    const ana = await verifiedParticipant(db, handler, { name: "Ana" });
    const bia = await verifiedParticipant(db, handler, { name: "Bia" });
    const caio = await verifiedParticipant(db, handler, { name: "Caio" });
    await befriend(ana, bia);
    await befriend(ana, caio);
    as(ana);
    const created = await chat.createGroupConversation({ memberIds: [bia.id, caio.id] });
    assert(created.data, created.serverError ?? "group not created");
    await chat.sendMessage({ conversationId: created.data.conversationId, body: "no grupo" });
    as(bia);
    await friends.removeFriend({ userId: ana.id });
    const after = await unreadOf(bia);
    expect(after.total).toBe(1);
    expect(after.latest).toBe("no grupo");
  });
});

describe("GIF favourites", () => {
  test("are saved once per slug, listed newest first and removed", async () => {
    const ana = await verifiedParticipant(db, handler, { name: "Ana" });
    as(ana);
    await gifs.favoriteGif({ slug: "cat-1" });
    await gifs.favoriteGif({ slug: "cat-2" });
    await gifs.favoriteGif({ slug: "cat-1" });
    expect((await gifs.listGifFavorites({})).data?.slugs.toSorted()).toEqual(["cat-1", "cat-2"]);
    await gifs.unfavoriteGif({ slug: "cat-1" });
    expect((await gifs.listGifFavorites({})).data).toEqual({ slugs: ["cat-2"] });
  });
});

describe("live updates", () => {
  test("a new message nudges every member's open tabs", async () => {
    const { ana, bia } = await friendsPair();
    const conversationId = await openWith(ana, bia);
    const heard: string[] = [];
    const stopAna = liveBus.subscribe(ana.id, (topic) => heard.push(`ana:${topic}`));
    const stopBia = liveBus.subscribe(bia.id, (topic) => heard.push(`bia:${topic}`));
    as(ana);
    await chat.sendMessage({ conversationId, body: "oi" });
    stopAna();
    stopBia();
    expect(heard).toEqual(expect.arrayContaining(["ana:messages", "bia:messages"]));
  });
});

describe("personal data (LGPD)", () => {
  test("the export carries conversations, sent messages and favourites", async () => {
    const { ana, bia } = await friendsPair();
    const conversationId = await openWith(ana, bia);
    await chat.sendMessage({ conversationId, body: "guardada" });
    await gifs.favoriteGif({ slug: "wave" });
    const data = await personalData(db, ana.id);
    expect(data.conversas).toEqual([
      expect.objectContaining({ id: conversationId, tipo: "direta", com: ["Bia"] }),
    ]);
    expect(data.mensagens_enviadas).toEqual([
      expect.objectContaining({ conversa: conversationId, texto: "guardada", gif: null }),
    ]);
    expect(data.gifs_favoritos).toEqual([expect.objectContaining({ gif: "wave" })]);
  });

  test("deleting the account removes their messages but keeps the other person's", async () => {
    const { ana, bia } = await friendsPair();
    const conversationId = await openWith(ana, bia);
    await chat.sendMessage({ conversationId, body: "da Ana" });
    await gifs.favoriteGif({ slug: "wave" });
    as(bia);
    await chat.sendMessage({ conversationId, body: "da Bia" });

    await db.transaction((tx) => anonymizeParticipant(tx, ana.id));

    const left = await db
      .select({ authorId: messages.authorId })
      .from(messages)
      .where(eq(messages.conversationId, conversationId));
    expect(left).toEqual([{ authorId: bia.id }]);
    expect(
      await db.select().from(conversationMembers).where(eq(conversationMembers.userId, ana.id)),
    ).toEqual([]);
    expect(await db.select().from(gifFavorites).where(eq(gifFavorites.userId, ana.id))).toEqual([]);
  });
});
