import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, test, vi } from "vitest";
import * as schema from "@/server/db/schema";

const requestHeaders = { current: new Headers() };
vi.mock("@/server/request-context.server", () => ({
  requestMemo: (load: () => unknown) => load,
  requestHeaders: () => requestHeaders.current,
}));
process.env.ADMIN_AUTH_SECRET = "segredo-admin-de-teste-0123456789abcdef0123456789";
const { adminSession } = await import("./support/admin-session");
const { sendTestMailAction } = await import("@/features/admin/mail/actions.server");
const { deliveryCounts, listRecentDeliveries } =
  await import("@/features/admin/mail/server/queries.server");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
afterAll(() => pool.end());

const HOUR = 60 * 60 * 1000;

describe("e-mail history", () => {
  test("lists the newest first and counts the last 24 hours", async () => {
    await db.insert(schema.mailDeliveries).values([
      {
        subject: "Antigo",
        provider: "resend",
        status: "accepted",
        createdAt: new Date(Date.now() - 30 * HOUR),
      },
      { subject: "Aceito", provider: "resend", status: "accepted", attempts: 1 },
      {
        subject: "Recusado",
        provider: "resend",
        status: "failed",
        reason: "validation_error",
        attempts: 1,
      },
    ]);

    const rows = await listRecentDeliveries(db);
    assert.equal(rows.at(-1)?.subject, "Antigo");
    assert.deepEqual(await deliveryCounts(db), { accepted: 1, refused: 1 });
  });
});

describe("test e-mail (mail.test)", () => {
  let owner: Awaited<ReturnType<typeof adminSession>>;
  let viewer: Awaited<ReturnType<typeof adminSession>>;
  beforeAll(async () => {
    owner = await adminSession(db, "owner");
    viewer = await adminSession(db, "viewer");
  });

  test("goes to the admin's own address, is audited and shows up in the history", async () => {
    requestHeaders.current = owner.headers;
    const result = await sendTestMailAction({});
    const [account] = await db
      .select({ email: schema.adminUsers.email })
      .from(schema.adminUsers)
      .where(eq(schema.adminUsers.id, owner.id));
    assert.deepEqual(result.data, { sentTo: account?.email });

    const audit = await db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.action, "mail.test"));
    assert.equal(audit.length, 1);
    assert.equal(audit[0]?.actorAdminId, owner.id);

    // Tests run without a provider: the attempt is recorded as not sent.
    const [delivery] = await db
      .select()
      .from(schema.mailDeliveries)
      .where(eq(schema.mailDeliveries.subject, "E-mail de teste do Nelcota"));
    assert.equal(delivery?.status, "not_sent");
    assert.equal(delivery?.reason, "no_provider");
    assert.equal(delivery?.recipientDomain, "exemplo.com");
  });

  test("a viewer cannot send it", async () => {
    requestHeaders.current = viewer.headers;
    const result = await sendTestMailAction({});
    assert.equal(result.serverError, "Você não tem permissão para fazer isso.");
  });
});
