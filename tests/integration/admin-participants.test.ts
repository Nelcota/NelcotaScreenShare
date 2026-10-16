import assert from "node:assert/strict";
import { and, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, test, vi } from "vitest";
import * as schema from "@/server/db/schema";
import { verifiedParticipant } from "./support/accounts";

/**
 * Participants page: bulk actions (by IDs and by filter), undo,
 * anonymization and the list queries, with an audit entry per item.
 */
const requestHeaders = { current: new Headers() };
vi.mock("@/server/request-context.server", () => ({
  requestMemo: (load: () => unknown) => load,
  requestHeaders: () => requestHeaders.current,
}));
process.env.ADMIN_AUTH_SECRET = "segredo-admin-de-teste-0123456789abcdef0123456789";
const { adminSession } = await import("./support/admin-session");
const actions = await import("@/features/admin/participants/actions.server");
const { listParticipants } = await import("@/features/admin/participants/server/queries.server");
const { loadParticipantParams } =
  await import("@/features/admin/participants/domain/search-params");
const { getUserAuth } = await import("@/features/auth/server/participant-auth.server");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
afterAll(() => pool.end());
const handler = (request: Request) => getUserAuth().handler(request);

type Session = Awaited<ReturnType<typeof adminSession>>;
let owner: Session;
let admin: Session;
let viewer: Session;
beforeAll(async () => {
  owner = await adminSession(db, "owner");
  admin = await adminSession(db, "admin");
  viewer = await adminSession(db, "viewer");
});

/** "Loose" participants (no session) with a marker in the name, for filtering. */
async function people(tag: string, count: number) {
  const rows = await db
    .insert(schema.users)
    .values(
      Array.from({ length: count }, (_, i) => ({
        name: `${tag} ${i}`,
        email: `${tag.toLowerCase()}-${i}-${crypto.randomUUID()}@exemplo.com`,
        emailVerified: true,
      })),
    )
    .returning({ id: schema.users.id });
  return rows.map((row) => row.id);
}

function auditsOf(action: string, ids: string[]) {
  return db
    .select()
    .from(schema.auditLogs)
    .where(and(eq(schema.auditLogs.action, action), inArray(schema.auditLogs.resourceId, ids)));
}

describe("block and unblock", () => {
  test("blocking requires a reason, drops the sessions and audits each account", async () => {
    const ana = await verifiedParticipant(db, handler);
    requestHeaders.current = admin.headers;
    const noReason = await actions.blockParticipantsAction({
      selection: { kind: "ids", ids: [ana.id] },
      reason: " ",
    });
    assert.ok(noReason.validationErrors, "no reason is rejected");

    const result = await actions.blockParticipantsAction({
      selection: { kind: "ids", ids: [ana.id] },
      reason: "Spam no chat",
    });
    assert.deepEqual(result.data, { count: 1 });
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, ana.id));
    assert.ok(user?.blockedAt);
    assert.equal(user?.blockReason, "Spam no chat");
    const sessions = await db
      .select()
      .from(schema.userSessions)
      .where(eq(schema.userSessions.userId, ana.id));
    assert.equal(sessions.length, 0);
    const [audit] = await auditsOf("user.block", [ana.id]);
    assert.equal(audit?.actorAdminId, admin.id);
    assert.deepEqual(audit?.metadata, { motivo: "Spam no chat" });

    // Blocking again changes nothing: a clear error, no repeated audit.
    const again = await actions.blockParticipantsAction({
      selection: { kind: "ids", ids: [ana.id] },
      reason: "De novo",
    });
    assert.equal(again.serverError, "Nenhuma conta para bloquear na seleção.");
    assert.equal((await auditsOf("user.block", [ana.id])).length, 1);
  });

  test("viewer cannot block", async () => {
    const [id = ""] = await people("Leitor", 1);
    requestHeaders.current = viewer.headers;
    const result = await actions.blockParticipantsAction({
      selection: { kind: "ids", ids: [id] },
      reason: "Tentativa",
    });
    assert.equal(result.serverError, "Você não tem permissão para fazer isso.");
  });

  test("all filter results: the server reapplies the search", async () => {
    const tag = `Filtro${Date.now()}`;
    const ids = await people(tag, 3);
    const [outsider] = await people(`Fora${Date.now()}`, 1);
    assert.ok(outsider);
    requestHeaders.current = admin.headers;
    const blocked = await actions.blockParticipantsAction({
      selection: { kind: "filter", query: `q=${tag}&cursor=ignorado` },
      reason: "Lote de teste",
    });
    assert.deepEqual(blocked.data, { count: 3 });
    assert.equal((await auditsOf("user.block", ids)).length, 3);
    const [other] = await db.select().from(schema.users).where(eq(schema.users.id, outsider));
    assert.equal(other?.blockedAt, null);

    const unblocked = await actions.unblockParticipantsAction({
      selection: { kind: "filter", query: `q=${tag}&status=bloqueado` },
    });
    assert.deepEqual(unblocked.data, { count: 3 });
  });

  test("a filter with more than 10,000 results is rejected", async () => {
    const tag = `Muitos${Date.now()}`;
    await pool.query(
      `insert into users (name, email, email_verified)
       select $1 || ' ' || g, $1 || g || '@exemplo.com', true from generate_series(1, 10001) g`,
      [tag],
    );
    requestHeaders.current = admin.headers;
    const result = await actions.blockParticipantsAction({
      selection: { kind: "filter", query: `q=${tag}` },
      reason: "Grande demais",
    });
    assert.equal(result.serverError, "Mais de 10.000 resultados. Refine o filtro e tente de novo.");
    const { rows } = await pool.query<{ n: number }>(
      "select count(*)::int as n from users where name like $1 and blocked_at is not null",
      [`${tag}%`],
    );
    assert.equal(rows[0]?.n, 0);
  });
});

describe("delete and undo", () => {
  test("deletion removes from the list, drops sessions and undo restores", async () => {
    const bia = await verifiedParticipant(db, handler);
    requestHeaders.current = admin.headers;
    const removed = await actions.deleteParticipantsAction({
      selection: { kind: "ids", ids: [bia.id] },
    });
    assert.deepEqual(removed.data, { ids: [bia.id] });
    const list = await listParticipants(
      db,
      loadParticipantParams(new URLSearchParams(`q=${encodeURIComponent(bia.email)}`)),
      50,
    );
    assert.equal(list.items.length, 0, "deleted does not show without the status filter");
    const deleted = await listParticipants(
      db,
      loadParticipantParams(
        new URLSearchParams(`q=${encodeURIComponent(bia.email)}&status=excluido`),
      ),
      50,
    );
    assert.equal(deleted.items[0]?.status, "excluido");

    const restored = await actions.restoreParticipantsAction({ ids: [bia.id] });
    assert.deepEqual(restored.data, { count: 1 });
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, bia.id));
    assert.equal(user?.deletedAt, null);
    assert.equal((await auditsOf("user.delete", [bia.id])).length, 1);
    assert.equal((await auditsOf("user.restore", [bia.id])).length, 1);
  });
});

describe("anonymize (LGPD)", () => {
  test("owner only, with the confirmation word; removes the name from history", async () => {
    const caio = await verifiedParticipant(db, handler, { name: "Caio Real" });
    const [room] = await db
      .insert(schema.rooms)
      .values({ code: `sala-anon-${Date.now().toString(36)}` })
      .returning();
    assert.ok(room);
    await db.insert(schema.roomParticipations).values({
      roomId: room.id,
      userId: caio.id,
      livekitIdentity: caio.id,
      livekitSid: `PA_${crypto.randomUUID()}`,
      displayName: "Caio Real",
      joinedAt: new Date(),
    });

    requestHeaders.current = admin.headers;
    const denied = await actions.anonymizeParticipantAction({
      id: caio.id,
      confirmation: "ANONIMIZAR",
    });
    assert.equal(denied.serverError, "Você não tem permissão para fazer isso.");

    requestHeaders.current = owner.headers;
    const wrongWord = await actions.anonymizeParticipantAction({
      id: caio.id,
      // @ts-expect-error: the wrong word is exactly what is being tested
      confirmation: "anonimizar",
    });
    assert.ok(wrongWord.validationErrors);

    const done = await actions.anonymizeParticipantAction({
      id: caio.id,
      confirmation: "ANONIMIZAR",
    });
    assert.deepEqual(done.data, { anonymized: true });
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, caio.id));
    assert.equal(user?.name, "Pessoa removida");
    assert.ok(user?.email.endsWith("@invalid.nelcota"));
    assert.ok(user?.anonymizedAt && user.deletedAt);
    const [participation] = await db
      .select()
      .from(schema.roomParticipations)
      .where(eq(schema.roomParticipations.userId, caio.id));
    assert.equal(participation?.displayName, null);
    // An anonymized account does not come back through "restore".
    const restore = await actions.restoreParticipantsAction({ ids: [caio.id] });
    assert.equal(restore.serverError, "Nada para restaurar.");
  });

  test("an old owner session must sign in again", async () => {
    const [id = ""] = await people("Antiga", 1);
    const stale = await adminSession(db, "owner");
    await db
      .update(schema.adminSessions)
      .set({ createdAt: sql`now() - interval '1 hour'` })
      .where(eq(schema.adminSessions.userId, stale.id));
    requestHeaders.current = stale.headers;
    const result = await actions.anonymizeParticipantAction({ id, confirmation: "ANONIMIZAR" });
    assert.equal(result.serverError, "Por segurança, entre de novo para fazer isso.");
  });
});

describe("list", () => {
  test("accent-insensitive search and sorting by participations", async () => {
    const tag = `Busca${Date.now()}`;
    const [joao = "", maria = ""] = (
      await db
        .insert(schema.users)
        .values([
          { name: `João ${tag}`, email: `joao-${tag}@exemplo.com`, participationsCount: 2 },
          { name: `Maria ${tag}`, email: `maria-${tag}@exemplo.com`, participationsCount: 9 },
        ])
        .returning({ id: schema.users.id })
    ).map((row) => row.id);
    const found = await listParticipants(
      db,
      loadParticipantParams(new URLSearchParams(`q=joao ${tag}`)),
      50,
    );
    assert.deepEqual(
      found.items.map((row) => row.id),
      [joao],
    );
    const sorted = await listParticipants(
      db,
      loadParticipantParams(new URLSearchParams(`q=${tag}&por=participacoes`)),
      50,
    );
    assert.deepEqual(
      sorted.items.map((row) => row.id),
      [maria, joao],
    );
  });

  test("the participations counter tracks the joins", async () => {
    const [id] = await people("Contador", 1);
    assert.ok(id);
    const [room] = await db
      .insert(schema.rooms)
      .values({ code: `sala-cont-${Date.now().toString(36)}` })
      .returning();
    assert.ok(room);
    await db.insert(schema.roomParticipations).values(
      [1, 2].map((n) => ({
        roomId: room.id,
        userId: id,
        livekitIdentity: id,
        livekitSid: `PA_${crypto.randomUUID()}`,
        joinedAt: new Date(Date.now() + n),
      })),
    );
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id));
    assert.equal(user?.participationsCount, 2);
  });

  test("the counter follows bulk inserts, deletes and a change of account", async () => {
    const [first, second] = await people("Lote", 2);
    assert.ok(first && second);
    const [room] = await db
      .insert(schema.rooms)
      .values({ code: `sala-lote-${Date.now().toString(36)}` })
      .returning();
    assert.ok(room);
    const owners = [first, first, first, second, second, null];
    const inserted = await db
      .insert(schema.roomParticipations)
      .values(
        owners.map((userId, n) => ({
          roomId: room.id,
          userId,
          livekitIdentity: userId ?? `convidado-${n}`,
          livekitSid: `PA_${crypto.randomUUID()}`,
          joinedAt: new Date(Date.now() + n),
        })),
      )
      .returning({ id: schema.roomParticipations.id });
    const counts = async () => {
      const rows = await db
        .select({ id: schema.users.id, count: schema.users.participationsCount })
        .from(schema.users)
        .where(inArray(schema.users.id, [first, second]));
      return Object.fromEntries(rows.map((row) => [row.id, row.count]));
    };
    assert.deepEqual(await counts(), { [first]: 3, [second]: 2 });

    const moved = inserted[0]?.id;
    assert.ok(moved);
    await db
      .update(schema.roomParticipations)
      .set({ userId: second })
      .where(eq(schema.roomParticipations.id, moved));
    assert.deepEqual(await counts(), { [first]: 2, [second]: 3 });

    await db.delete(schema.roomParticipations).where(eq(schema.roomParticipations.roomId, room.id));
    assert.deepEqual(await counts(), { [first]: 0, [second]: 0 });
  });
});

async function unverified() {
  const [user] = await db
    .insert(schema.users)
    .values({ name: "Sem Confirmar", email: `reenvio-${crypto.randomUUID()}@exemplo.com` })
    .returning({ id: schema.users.id });
  assert.ok(user);
  return user.id;
}

async function resendAudits(id: string) {
  return db
    .select()
    .from(schema.auditLogs)
    .where(
      and(
        eq(schema.auditLogs.resourceId, id),
        eq(schema.auditLogs.action, "user.verification_resend"),
      ),
    );
}

describe("resend the confirmation e-mail", () => {
  test("at most 3 per account per hour, even from the panel", async () => {
    const id = await unverified();
    requestHeaders.current = admin.headers;
    for (let attempt = 0; attempt < 3; attempt++) {
      const sent = await actions.resendVerificationAction({ id });
      assert.deepEqual(sent.data, { sent: true });
    }
    const fourth = await actions.resendVerificationAction({ id });
    assert.match(fourth.serverError ?? "", /Tente de novo mais tarde/);
    assert.equal((await resendAudits(id)).length, 3);
  });

  test("an e-mail that fails to go out leaves no audit row", async () => {
    const id = await unverified();
    requestHeaders.current = admin.headers;
    const send = vi
      .spyOn(getUserAuth().api, "sendVerificationEmail")
      .mockRejectedValueOnce(new Error("smtp down"));
    const result = await actions.resendVerificationAction({ id });
    send.mockRestore();
    assert.ok(result.serverError);
    assert.equal((await resendAudits(id)).length, 0);
  });
});
