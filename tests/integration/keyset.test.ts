import assert from "node:assert/strict";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, test } from "vitest";
import { listAuditLogs } from "@/features/admin/audit/server/queries.server";
import { loadAuditParams, type AuditParams } from "@/features/admin/audit/domain/search-params";
import * as schema from "@/server/db/schema";
import { approximateCount, COUNT_CAP } from "@/server/table/keyset.server";
import { sql } from "drizzle-orm";
import {
  listParticipants,
  iterateParticipants,
} from "@/features/admin/participants/server/queries.server";
import type { ParticipantParams } from "@/features/admin/participants/domain/search-params";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
afterAll(() => pool.end());

const base: AuditParams = {
  cursor: null,
  dir: "next",
  ordem: "desc",
  q: "",
  acao: null,
  recurso: null,
  autor: null,
  de: null,
  ate: null,
};

beforeAll(async () => {
  // 125 rows across only 3 timestamps: deliberate ties (the id breaks them).
  await pool.query(`
    insert into audit_logs (action, resource_type, resource_id, created_at)
    select case when g % 5 = 0 then 'room.close' else 'auth.sign_in' end, 'teste', g::text,
           timestamptz '2026-10-01 12:00:00+00' + (g % 3) * interval '1 hour'
    from generate_series(1, 125) as g`);
});

async function walk(params: AuditParams, limit: number) {
  const seen: string[] = [];
  let page = await listAuditLogs(db, params, limit);
  const pages = [page];
  seen.push(...page.items.map((row) => row.id));
  while (page.nextCursor) {
    page = await listAuditLogs(db, { ...params, cursor: page.nextCursor, dir: "next" }, limit);
    pages.push(page);
    seen.push(...page.items.map((row) => row.id));
  }
  return { seen, pages };
}

describe("keyset pagination", () => {
  test("the audit page loads without any query parameters", async () => {
    const page = await listAuditLogs(db, loadAuditParams(new URLSearchParams()), 10);
    assert.equal(page.items.length, 10);
    assert.equal(page.total, 125);
  });
  for (const ordem of ["asc", "desc"] as const) {
    test(`last seen ${ordem}: walks forward and back across filled and null values`, async () => {
      const q = `nulos-${ordem}`;
      await db.insert(schema.users).values(
        Array.from({ length: 7 }, (_, index) => ({
          name: `Pessoa ${index}`,
          email: `${q}-${index}@exemplo.com`,
          lastSeenAt:
            index < 4 ? new Date(`2026-10-0${Math.floor(index / 2) + 1}T12:00:00Z`) : null,
        })),
      );
      const params: ParticipantParams = {
        q,
        ordem,
        por: "acesso",
        cursor: null,
        dir: "next",
        status: null,
        de: null,
        ate: null,
      };
      let page = await listParticipants(db, params, 2);
      const pages = [page];
      while (page.nextCursor) {
        page = await listParticipants(db, { ...params, cursor: page.nextCursor }, 2);
        pages.push(page);
        assert.ok(pages.length <= 4, "navigation does not repeat pages");
      }
      const all = pages.flatMap((entry) => entry.items);
      assert.equal(all.length, 7);
      assert.equal(new Set(all.map((row) => row.id)).size, 7);
      assert.ok(all.slice(0, 4).every((row) => row.lastSeenAt !== null));
      assert.ok(all.slice(4).every((row) => row.lastSeenAt === null));
      for (let index = pages.length - 2; index >= 0; index--) {
        assert.ok(page.prevCursor);
        page = await listParticipants(db, { ...params, cursor: page.prevCursor, dir: "prev" }, 2);
        assert.deepEqual(
          page.items.map((row) => row.id),
          pages[index]?.items.map((row) => row.id),
        );
      }
      assert.equal(page.prevCursor, null);
      const exported = [];
      for await (const row of iterateParticipants(db, params)) exported.push(row.id);
      assert.deepEqual(
        exported,
        all.map((row) => row.id),
      );
    });
  }

  test("walks through everything without repeating or skipping, in the right order", async () => {
    const { seen, pages } = await walk(base, 10);
    assert.equal(seen.length, 125);
    assert.equal(new Set(seen).size, 125);
    assert.equal(pages.length, 13);
    assert.equal(pages[0]?.prevCursor, null, "first page has no previous");
    const times = pages.flatMap((page) => page.items.map((row) => row.createdAt));
    assert.deepEqual(times, times.toSorted().toReversed());
  });

  test("goes back page by page to the first, with the same items", async () => {
    const { pages } = await walk(base, 10);
    let current = pages.at(-1);
    for (let index = pages.length - 2; index >= 0; index--) {
      assert.ok(current?.prevCursor);
      current = await listAuditLogs(db, { ...base, cursor: current.prevCursor, dir: "prev" }, 10);
      assert.deepEqual(
        current.items.map((row) => row.id),
        pages[index]?.items.map((row) => row.id),
        `page ${index + 1}`,
      );
    }
    assert.equal(current?.prevCursor, null);
  });

  test("ascending order and action filter", async () => {
    const asc = await walk({ ...base, ordem: "asc", acao: "room.close" }, 7);
    assert.equal(asc.seen.length, 25);
    const times = asc.pages.flatMap((page) => page.items.map((row) => row.createdAt));
    assert.deepEqual(times, times.toSorted());
  });

  test("microseconds do not make the boundary repeat or vanish", async () => {
    await pool.query(`
      insert into audit_logs (action, resource_type, resource_id, created_at)
      select 'auth.lockout', 'micro', g::text,
             timestamptz '2026-09-01 12:00:00.123456+00' + g * interval '1 microsecond'
      from generate_series(1, 30) as g`);
    const filter = { ...base, acao: "auth.lockout" };
    const { seen, pages } = await walk(filter, 4);
    assert.equal(new Set(seen).size, 30);
    assert.equal(seen.length, 30);
    const back = await listAuditLogs(
      db,
      { ...filter, cursor: pages[1]?.prevCursor ?? null, dir: "prev" },
      4,
    );
    assert.deepEqual(
      back.items.map((row) => row.id),
      pages[0]?.items.map((row) => row.id),
    );
  });

  test("tampered cursor falls back to the first page", async () => {
    const page = await listAuditLogs(db, { ...base, cursor: "lixo!!" }, 10);
    assert.equal(page.items.length, 10);
    assert.equal(page.prevCursor, null);
  });

  test(`approximate total stops at ${COUNT_CAP}`, async () => {
    await pool.query(`
      insert into audit_logs (action, resource_type, created_at)
      select 'auth.sign_in', 'carga', now() from generate_series(1, ${COUNT_CAP + 5})`);
    const count = await approximateCount(db, sql`select 1 from audit_logs`);
    assert.deepEqual(count, { total: COUNT_CAP, capped: true });
  });
});
