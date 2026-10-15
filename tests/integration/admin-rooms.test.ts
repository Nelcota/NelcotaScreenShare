import assert from "node:assert/strict";
import { and, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, test, vi } from "vitest";
import * as schema from "@/server/db/schema";

/** Rooms page: delete/restore, internal note and invites. */
const requestHeaders = { current: new Headers() };
vi.mock("@/server/request-context.server", () => ({
  requestMemo: (load: () => unknown) => load,
  requestHeaders: () => requestHeaders.current,
}));
// LiveKit for "remove from the call": who is connected, and the current call's sid.
const liveKit = vi.hoisted(() => ({ connected: new Set<string>(), removed: [] as string[] }));
vi.mock("@/features/room/server/livekit-gateway.server", () => ({
  liveKitGateway: {
    roomSid: () => Promise.resolve("RM_chamada-atual"),
    removeParticipant: (_room: string, identity: string) => {
      if (!liveKit.connected.has(identity)) return Promise.resolve(false);
      liveKit.removed.push(identity);
      return Promise.resolve(true);
    },
  },
}));
process.env.ADMIN_AUTH_SECRET = "segredo-admin-de-teste-0123456789abcdef0123456789";
const { adminSession } = await import("./support/admin-session");
const actions = await import("@/features/admin/rooms/actions.server");
const { hashInviteToken } = await import("@/features/room/server/invites.server");
const { searchPanelAction } = await import("@/features/admin/search/actions.server");
const { removedFromCall } = await import("@/features/admin/rooms/server/room-removals.server");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
afterAll(() => pool.end());

type Session = Awaited<ReturnType<typeof adminSession>>;
let admin: Session;
let viewer: Session;
beforeAll(async () => {
  admin = await adminSession(db, "admin");
  viewer = await adminSession(db, "viewer");
});

let counter = 0;
async function room(status: "active" | "finished" = "finished") {
  counter += 1;
  const [row] = await db
    .insert(schema.rooms)
    .values({
      code: `sala-adm-${counter}-${Date.now().toString(36)}`,
      status,
      finishedAt: status === "finished" ? new Date() : null,
      startedAt: new Date(Date.now() - 60_000),
    })
    .returning();
  assert.ok(row);
  return row;
}

describe("delete and restore", () => {
  test("a live room cannot be deleted", async () => {
    const live = await room("active");
    requestHeaders.current = admin.headers;
    const result = await actions.deleteRoomsAction({ selection: { kind: "ids", ids: [live.id] } });
    assert.equal(
      result.serverError,
      `A sala ${live.code} está ao vivo. Encerre a sala antes de excluir.`,
    );
  });

  test("deletes, undoes and audits", async () => {
    const done = await room();
    requestHeaders.current = admin.headers;
    const removed = await actions.deleteRoomsAction({ selection: { kind: "ids", ids: [done.id] } });
    assert.deepEqual(removed.data, { ids: [done.id] });
    const restored = await actions.restoreRoomsAction({ ids: [done.id] });
    assert.deepEqual(restored.data, { count: 1 });
    const audits = await db
      .select({ action: schema.auditLogs.action })
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.resourceId, done.id));
    assert.deepEqual(audits.map((row) => row.action).toSorted(), ["room.delete", "room.restore"]);
  });

  test("restoring does not create two live rooms with the same code", async () => {
    const old = await room();
    requestHeaders.current = admin.headers;
    await actions.deleteRoomsAction({ selection: { kind: "ids", ids: [old.id] } });
    // The code is used again by a new room.
    await db.insert(schema.rooms).values({ code: old.code });
    const result = await actions.restoreRoomsAction({ ids: [old.id] });
    assert.equal(
      result.serverError,
      "Nada para restaurar. O código pode já estar em uso por outra sala.",
    );
  });

  test("viewer cannot delete", async () => {
    const done = await room();
    requestHeaders.current = viewer.headers;
    const result = await actions.deleteRoomsAction({ selection: { kind: "ids", ids: [done.id] } });
    assert.equal(result.serverError, "Você não tem permissão para fazer isso.");
  });

  test("restores one selected generation per code and restores unrelated rooms in the same batch", async () => {
    const old = await room();
    const other = await room();
    await db
      .update(schema.rooms)
      .set({ deletedAt: new Date(1_000) })
      .where(eq(schema.rooms.id, old.id));
    await db
      .update(schema.rooms)
      .set({ deletedAt: new Date(1_000) })
      .where(eq(schema.rooms.id, other.id));
    const [newer] = await db
      .insert(schema.rooms)
      .values({
        code: old.code,
        status: "finished",
        deletedAt: new Date(2_000),
      })
      .returning();
    assert.ok(newer);
    requestHeaders.current = admin.headers;
    const result = await actions.restoreRoomsAction({ ids: [old.id, newer.id, other.id] });
    assert.deepEqual(result.data, { count: 2 });
    const restored = await db
      .select({ id: schema.rooms.id, deletedAt: schema.rooms.deletedAt })
      .from(schema.rooms)
      .where(inArray(schema.rooms.id, [old.id, newer.id, other.id]));
    assert.ok(restored.find((row) => row.id === old.id)?.deletedAt);
    assert.equal(restored.find((row) => row.id === newer.id)?.deletedAt, null);
    assert.equal(restored.find((row) => row.id === other.id)?.deletedAt, null);
    const audits = await db
      .select({ id: schema.auditLogs.resourceId })
      .from(schema.auditLogs)
      .where(
        and(
          eq(schema.auditLogs.action, "room.restore"),
          inArray(schema.auditLogs.resourceId, [old.id, newer.id, other.id]),
        ),
      );
    assert.equal(audits.length, 2);
    assert.deepEqual(new Set(audits.map((row) => row.id)), new Set([newer.id, other.id]));
  });
});

describe("internal note", () => {
  test("saves with a diff in the audit; no change is rejected", async () => {
    const target = await room();
    requestHeaders.current = admin.headers;
    const saved = await actions.updateRoomNoteAction({ id: target.id, note: "  Treinamento  " });
    assert.deepEqual(saved.data, { saved: true });
    const [audit] = await db
      .select()
      .from(schema.auditLogs)
      .where(
        and(eq(schema.auditLogs.action, "room.update"), eq(schema.auditLogs.resourceId, target.id)),
      );
    assert.deepEqual(audit?.changes, { note: { antes: null, depois: "Treinamento" } });
    const same = await actions.updateRoomNoteAction({ id: target.id, note: "Treinamento" });
    assert.equal(same.serverError, "A nota não mudou.");
  });
});

describe("invites", () => {
  test("creates (link with token, only the hash in the database) and revokes", async () => {
    const target = await room();
    requestHeaders.current = admin.headers;
    const created = await actions.createInviteAction({
      roomId: target.id,
      label: "Turma A",
      maxUses: 5,
      validityHours: 24,
    });
    const link = created.data?.link ?? "";
    const token = new URL(link).searchParams.get("convite") ?? "";
    assert.match(link, new RegExp(`/sala/${target.code}\\?convite=`));
    assert.equal(token.length, 43);
    const [invite] = await db
      .select()
      .from(schema.roomInvites)
      .where(eq(schema.roomInvites.roomId, target.id));
    assert.deepEqual(invite?.tokenHash, hashInviteToken(token));
    assert.equal(invite?.maxUses, 5);
    assert.ok(invite?.expiresAt && invite.expiresAt.getTime() > Date.now() + 23 * 3_600_000);

    const revoked = await actions.revokeInviteAction({ id: invite?.id ?? "" });
    assert.deepEqual(revoked.data, { revoked: true });
    const again = await actions.revokeInviteAction({ id: invite?.id ?? "" });
    assert.equal(again.serverError, "Esse convite já foi revogado.");
  });

  test("a validity outside the options is rejected; viewer cannot create", async () => {
    const target = await room();
    requestHeaders.current = admin.headers;
    const odd = await actions.createInviteAction({
      roomId: target.id,
      label: "",
      maxUses: null,
      validityHours: 5,
    });
    assert.ok(odd.validationErrors);
    requestHeaders.current = viewer.headers;
    const denied = await actions.createInviteAction({
      roomId: target.id,
      label: "",
      maxUses: null,
      validityHours: null,
    });
    assert.equal(denied.serverError, "Você não tem permissão para fazer isso.");
  });
});

/** Someone connected right now to a live room. */
async function inCall(identity: string) {
  const live = await room("active");
  const [participation] = await db
    .insert(schema.roomParticipations)
    .values({
      roomId: live.id,
      livekitIdentity: identity,
      livekitSid: `PA_${crypto.randomUUID()}`,
      joinedAt: new Date(Date.now() - 30_000),
    })
    .returning({ id: schema.roomParticipations.id });
  assert.ok(participation);
  liveKit.connected.add(identity);
  return { live, participationId: participation.id };
}

describe("remove from the call", () => {
  test("kicks and audits; the person is not banned", async () => {
    const identity = `convidado-${crypto.randomUUID()}`;
    const { live, participationId } = await inCall(identity);
    requestHeaders.current = admin.headers;
    const result = await actions.removeParticipantAction({ participationId, action: "kick" });
    assert.deepEqual(result.data, { removed: true });
    assert.ok(liveKit.removed.includes(identity));
    const bans = await db
      .select()
      .from(schema.roomBans)
      .where(eq(schema.roomBans.identity, identity));
    assert.equal(bans.length, 0);
    const [audit] = await db
      .select({ action: schema.auditLogs.action })
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.resourceId, live.id));
    assert.equal(audit?.action, "room.participant_kick");
  });

  test("bans for the current call, recorded with the admin", async () => {
    const identity = `convidado-${crypto.randomUUID()}`;
    const { live, participationId } = await inCall(identity);
    requestHeaders.current = admin.headers;
    const result = await actions.removeParticipantAction({ participationId, action: "ban" });
    assert.deepEqual(result.data, { removed: true });
    const [ban] = await db
      .select()
      .from(schema.roomBans)
      .where(eq(schema.roomBans.identity, identity));
    assert.equal(ban?.roomCode, live.code);
    assert.equal(ban?.livekitRoomSid, "RM_chamada-atual");
    assert.equal(ban?.bannedByAdminId, admin.id);
  });

  test("someone who already left, and a viewer, are refused", async () => {
    const identity = `convidado-${crypto.randomUUID()}`;
    const { participationId } = await inCall(identity);
    requestHeaders.current = viewer.headers;
    const denied = await actions.removeParticipantAction({ participationId, action: "kick" });
    assert.equal(denied.serverError, "Você não tem permissão para fazer isso.");

    await db
      .update(schema.roomParticipations)
      .set({ leftAt: new Date() })
      .where(eq(schema.roomParticipations.id, participationId));
    requestHeaders.current = admin.headers;
    const gone = await actions.removeParticipantAction({ participationId, action: "kick" });
    assert.equal(gone.serverError, "Essa pessoa já saiu da sala.");
  });

  test("a removal LiveKit refuses leaves no audit row behind", async () => {
    const identity = `convidado-${crypto.randomUUID()}`;
    const { live, participationId } = await inCall(identity);
    // Still listed in the database, but no longer connected to LiveKit.
    liveKit.connected.delete(identity);
    requestHeaders.current = admin.headers;
    const result = await actions.removeParticipantAction({ participationId, action: "kick" });
    assert.equal(result.serverError, "Essa pessoa já saiu da sala.");
    const audits = await db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.resourceId, live.id));
    assert.equal(audits.length, 0);
  });
});

/** Someone banned from the call by the panel, with the name typed for it. */
async function banned(identity: string) {
  const { live, participationId } = await inCall(identity);
  await db
    .update(schema.roomParticipations)
    .set({ displayName: "Diego" })
    .where(eq(schema.roomParticipations.id, participationId));
  requestHeaders.current = admin.headers;
  const result = await actions.removeParticipantAction({ participationId, action: "ban" });
  assert.deepEqual(result.data, { removed: true });
  return live;
}

const liveKitDown = () => Promise.reject(new Error("offline"));

describe("let a banned person back", () => {
  test("lists the ban with the name used in the call, made from the panel", async () => {
    const identity = `convidado-${crypto.randomUUID()}`;
    const live = await banned(identity);
    const removals = await removedFromCall(db, live);
    assert.equal(removals?.length, 1);
    assert.equal(removals?.[0]?.name, "Diego");
    assert.deepEqual(removals?.[0]?.removedBy, { kind: "panel" });
  });

  test("lifts the ban for this call and audits it; a second time is refused", async () => {
    const identity = `convidado-${crypto.randomUUID()}`;
    const live = await banned(identity);
    const result = await actions.readmitParticipantAction({ roomId: live.id, identity });
    assert.deepEqual(result.data, { readmitted: true });
    assert.deepEqual(await removedFromCall(db, live), []);
    const [audit] = await db
      .select({ action: schema.auditLogs.action })
      .from(schema.auditLogs)
      .where(
        and(
          eq(schema.auditLogs.resourceId, live.id),
          eq(schema.auditLogs.action, "room.participant_unban"),
        ),
      );
    assert.ok(audit);

    const again = await actions.readmitParticipantAction({ roomId: live.id, identity });
    assert.equal(again.serverError, "Essa pessoa já pode voltar.");
  });

  test("a viewer cannot let anyone back", async () => {
    const identity = `convidado-${crypto.randomUUID()}`;
    const live = await banned(identity);
    requestHeaders.current = viewer.headers;
    const denied = await actions.readmitParticipantAction({ roomId: live.id, identity });
    assert.equal(denied.serverError, "Você não tem permissão para fazer isso.");
  });

  test("without an answer from LiveKit the list is unavailable, not empty", async () => {
    const live = await room("active");
    assert.equal(await removedFromCall(db, live, liveKitDown), null);
  });
});

describe("command palette search", () => {
  test("finds a room by part of its code and a person without accents; ignores deleted ones", async () => {
    const target = await room();
    const gone = await room();
    await db
      .update(schema.rooms)
      .set({ deletedAt: new Date() })
      .where(eq(schema.rooms.id, gone.id));
    const tag = `Busca${Date.now()}`;
    const [person] = await db
      .insert(schema.users)
      .values({ name: `Joana Côrtes ${tag}`, email: `joana-${tag}@exemplo.com` })
      .returning({ id: schema.users.id });
    requestHeaders.current = viewer.headers;
    const byCode = await searchPanelAction({ q: target.code.slice(-8) });
    assert.deepEqual(
      byCode.data?.rooms.map((row) => row.id),
      [target.id],
    );
    const deleted = await searchPanelAction({ q: gone.code });
    assert.deepEqual(deleted.data?.rooms, []);
    const byName = await searchPanelAction({ q: `cortes ${tag}` });
    assert.deepEqual(
      byName.data?.people.map((row) => row.id),
      [person?.id],
    );
    const short = await searchPanelAction({ q: "a" });
    assert.ok(short.validationErrors, "fewer than 2 letters does not search");
  });
});
