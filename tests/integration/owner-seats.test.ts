import assert from "node:assert/strict";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeEach, describe, test } from "vitest";
import * as schema from "@/server/db/schema";
import { ownerSeatsTaken, panelRoleOfEmail } from "@/features/auth/server/owner-seats.server";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
afterAll(() => pool.end());

const HOUR = 60 * 60 * 1000;

async function admin(email: string, role: string) {
  await db.insert(schema.adminUsers).values({ name: email, email, role });
}

async function invitation(email: string, status: "pending" | "revoked", expiresInMs: number) {
  await db.insert(schema.adminInvitations).values({
    email,
    role: "owner",
    tokenHash: crypto.randomUUID(),
    status,
    expiresAt: new Date(Date.now() + expiresInMs),
    createdAt: new Date(Date.now() - 2 * HOUR),
  });
}

describe("owner seats", () => {
  beforeEach(async () => {
    await db.delete(schema.adminInvitations);
    await db.delete(schema.adminUsers);
  });

  test("owners and pending owner invitations take seats; admins do not", async () => {
    await admin("dona@exemplo.com", "owner");
    await admin("admin@exemplo.com", "admin");
    await invitation("nova@exemplo.com", "pending", HOUR);
    assert.equal(await ownerSeatsTaken(db), 2);
  });

  test("expired, revoked and already used invitations free their seat", async () => {
    await invitation("vencida@exemplo.com", "pending", -HOUR);
    await invitation("revogada@exemplo.com", "revoked", HOUR);
    await admin("aceitou@exemplo.com", "owner");
    await invitation("aceitou@exemplo.com", "pending", HOUR);
    assert.equal(await ownerSeatsTaken(db), 1);
  });

  test("the role of an e-mail ignores letter case", async () => {
    await admin("Admin@Exemplo.com", "admin");
    assert.equal(await panelRoleOfEmail(db, " admin@exemplo.COM "), "admin");
    assert.equal(await panelRoleOfEmail(db, "ninguem@exemplo.com"), null);
  });

  test("an invitation keeps its seat while acceptance is creating the owner", async () => {
    await db.insert(schema.adminInvitations).values({
      email: "accepting@example.com",
      role: "owner",
      tokenHash: crypto.randomUUID(),
      status: "accepted",
      acceptedAt: new Date(Date.now() - HOUR - 1),
      createdAt: new Date(Date.now() - 2 * HOUR),
      // Acceptance can finish after expiry: the claimed seat must stay reserved.
      expiresAt: new Date(Date.now() - HOUR),
    });
    assert.equal(await ownerSeatsTaken(db), 1);
    await admin("accepting@example.com", "owner");
    assert.equal(await ownerSeatsTaken(db), 1);
  });
});
