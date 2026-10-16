import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";
import * as schema from "@/server/db/schema";
import { runMaintenance } from "@/features/runtime/server/maintenance.server";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
afterAll(() => pool.end());

const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(Date.now() - days * DAY);

async function participation(code: string, joinedDaysAgo: number) {
  const [room] = await db.insert(schema.rooms).values({ code }).returning();
  const [row] = await db
    .insert(schema.roomParticipations)
    .values({
      roomId: room!.id,
      livekitIdentity: "pessoa",
      livekitSid: `PA_${crypto.randomUUID()}`,
      displayName: "Nome",
      ip: "203.0.113.5",
      joinedAt: ago(joinedDaysAgo),
      leftAt: ago(joinedDaysAgo),
    })
    .returning();
  return row!.id;
}

describe("maintenance", () => {
  it("applies retention and keeps what is still within the period", async () => {
    const [oldToken] = await db
      .insert(schema.tokenRequests)
      .values({ roomCode: "velha", result: "granted", createdAt: ago(200) })
      .returning();
    const [newToken] = await db
      .insert(schema.tokenRequests)
      .values({ roomCode: "nova", result: "granted" })
      .returning();
    const yearOld = await participation("sala-ano-velho", 400);
    const halfYearOld = await participation("sala-meio-ano", 190);
    const recent = await participation("sala-recente", 1);
    await db.insert(schema.livekitEvents).values([
      {
        id: "EV_velho",
        event: "room_started",
        payload: {},
        occurredAt: ago(40),
        receivedAt: ago(40),
        processedAt: ago(40),
      },
      {
        id: "EV_novo",
        event: "room_started",
        payload: {},
        occurredAt: ago(1),
        processedAt: ago(1),
      },
    ]);

    await db.insert(schema.mailDeliveries).values([
      { subject: "Velho", provider: "smtp", status: "accepted", createdAt: ago(31) },
      { subject: "Novo", provider: "smtp", status: "failed", reason: "EAUTH" },
    ]);
    await db.insert(schema.appErrors).values([
      { method: "GET", path: "/velho", name: "Error", message: "velho", createdAt: ago(31) },
      { method: "GET", path: "/novo", name: "Error", message: "novo" },
    ]);

    const report = await runMaintenance(db);

    expect(report.tokenRequests).toBeGreaterThanOrEqual(1);
    const tokens = await db.select({ id: schema.tokenRequests.id }).from(schema.tokenRequests);
    expect(tokens.map((row) => row.id)).toContain(newToken!.id);
    expect(tokens.map((row) => row.id)).not.toContain(oldToken!.id);

    const byId = async (id: string) =>
      (
        await db
          .select()
          .from(schema.roomParticipations)
          .where(eq(schema.roomParticipations.id, id))
      )[0];
    expect(await byId(yearOld)).toMatchObject({ ip: null, displayName: null });
    expect(await byId(halfYearOld)).toMatchObject({ ip: null, displayName: "Nome" });
    expect(await byId(recent)).toMatchObject({ ip: "203.0.113.5", displayName: "Nome" });

    const events = await db.select({ id: schema.livekitEvents.id }).from(schema.livekitEvents);
    expect(events.map((row) => row.id)).toEqual(["EV_novo"]);

    expect(report.mailDeliveries).toBe(1);
    const mails = await db
      .select({ subject: schema.mailDeliveries.subject })
      .from(schema.mailDeliveries);
    expect(mails).toEqual([{ subject: "Novo" }]);
    expect(report.appErrors).toBe(1);
    const errors = await db.select({ message: schema.appErrors.message }).from(schema.appErrors);
    expect(errors).toEqual([{ message: "novo" }]);
  });

  it("reprocesses only pending events that did not just arrive", async () => {
    await db.insert(schema.livekitEvents).values([
      {
        id: "EV_pendente_antigo",
        event: "room_started",
        roomName: "sala-pendente",
        payload: { event: "room_started", room: { name: "sala-pendente" } },
        occurredAt: ago(1),
        receivedAt: ago(1),
      },
      {
        id: "EV_chegando",
        event: "room_started",
        roomName: "sala-chegando",
        payload: { event: "room_started", room: { name: "sala-chegando" } },
        occurredAt: new Date(),
      },
    ]);

    await runMaintenance(db);

    const rows = await db.select().from(schema.livekitEvents);
    const state = Object.fromEntries(rows.map((row) => [row.id, row.processedAt !== null]));
    expect(state).toMatchObject({ EV_pendente_antigo: true, EV_chegando: false });
  });

  it("clears requests to enter a room after a week", async () => {
    const code = `sala-pedidos-${Date.now().toString(36)}`;
    await db.insert(schema.roomDefinitions).values({ code });
    const request = (createdDaysAgo: number) => ({
      roomCode: code,
      guestId: crypto.randomUUID(),
      displayName: "Visita",
      status: "expired" as const,
      createdAt: ago(createdDaysAgo),
      expiresAt: ago(createdDaysAgo),
    });
    const [old] = await db.insert(schema.roomJoinRequests).values(request(8)).returning();
    const [fresh] = await db.insert(schema.roomJoinRequests).values(request(1)).returning();

    const report = await runMaintenance(db);

    expect(report.joinRequests).toBeGreaterThanOrEqual(1);
    const left = await db
      .select({ id: schema.roomJoinRequests.id })
      .from(schema.roomJoinRequests)
      .where(eq(schema.roomJoinRequests.roomCode, code));
    expect(left.map((row) => row.id)).toEqual([fresh!.id]);
    expect(left.map((row) => row.id)).not.toContain(old!.id);
  });
});

describe("room bans", () => {
  it("are deleted a week after the ban; recent ones stay", async () => {
    const [oldBan, recentBan] = await db
      .insert(schema.roomBans)
      .values([
        {
          roomCode: "ban-velho",
          identity: "pessoa",
          livekitRoomSid: "RM_velha",
          createdAt: ago(8),
        },
        { roomCode: "ban-novo", identity: "pessoa", livekitRoomSid: "RM_nova" },
      ])
      .returning();
    const report = await runMaintenance(db);
    expect(report.roomBans).toBeGreaterThanOrEqual(1);
    const left = await db.select({ id: schema.roomBans.id }).from(schema.roomBans);
    const ids = left.map((row) => row.id);
    expect(ids).not.toContain(oldBan!.id);
    expect(ids).toContain(recentBan!.id);
  });
});

describe("audit logs", () => {
  it("are deleted after 5 years; younger ones stay", async () => {
    const [expired, kept] = await db
      .insert(schema.auditLogs)
      .values([
        {
          action: "user.self_delete",
          resourceType: "user",
          ip: "203.0.113.9",
          createdAt: ago(5 * 366),
        },
        {
          action: "user.self_delete",
          resourceType: "user",
          ip: "203.0.113.9",
          createdAt: ago(5 * 365 - 30),
        },
      ])
      .returning();
    const report = await runMaintenance(db);
    expect(report.auditLogs).toBeGreaterThanOrEqual(1);
    const left = await db.select({ id: schema.auditLogs.id }).from(schema.auditLogs);
    const ids = left.map((row) => row.id);
    expect(ids).not.toContain(expired!.id);
    expect(ids).toContain(kept!.id);
  });
});
