import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, test } from "vitest";
import * as schema from "@/server/db/schema";
import { buildCreateOwner } from "@/scripts/build-scripts";

/**
 * The terminal scripts run as esbuild bundles (`pnpm build:scripts`, the Docker image),
 * where every bundled module shares one scope: a name declared twice breaks the file.
 */
const run = promisify(execFile);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
let outdir = "";

beforeAll(async () => {
  // Inside the project: the bundle resolves its external packages from node_modules.
  outdir = await mkdtemp(join(process.cwd(), "node_modules", ".cache-cli-scripts-"));
  await buildCreateOwner(outdir);
}, 60_000);

afterAll(async () => {
  await pool.end();
  if (outdir) await rm(outdir, { recursive: true, force: true });
});

/** Runs the bundle and returns its exit code and error output, failing or not. */
async function runCreateOwner(args: string[]): Promise<{ code: number; stderr: string }> {
  try {
    await run(process.execPath, [join(outdir, "create-owner.mjs"), ...args], {
      env: { ...process.env, APP_URL: "https://app.example.com" },
    });
    return { code: 0, stderr: "" };
  } catch (error) {
    if (!error || typeof error !== "object" || !("code" in error) || !("stderr" in error))
      throw error;
    return { code: Number(error.code), stderr: String(error.stderr) };
  }
}

describe("bundled create-owner", () => {
  test("creates the first owner's invitation", async () => {
    const email = `dono-${crypto.randomUUID()}@exemplo.com`;
    const { stdout } = await run(process.execPath, [join(outdir, "create-owner.mjs"), email], {
      env: { ...process.env, APP_URL: "https://app.example.com" },
    });
    assert.match(stdout, new RegExp(`Owner invitation for ${email}`));
    assert.match(stdout, /https:\/\/app\.example\.com\/admin\/convite\//);
    const [invitation] = await db
      .select({ role: schema.adminInvitations.role })
      .from(schema.adminInvitations)
      .where(eq(schema.adminInvitations.email, email));
    assert.equal(invitation?.role, "owner");
  });

  test("refuses a fourth owner and never promotes an admin", async () => {
    for (const index of [1, 2, 3]) {
      await db.insert(schema.adminUsers).values({
        name: `Dono ${index}`,
        email: `dono-${index}-${crypto.randomUUID()}@exemplo.com`,
        role: "owner",
      });
    }
    const adminEmail = `admin-${crypto.randomUUID()}@exemplo.com`;
    await db.insert(schema.adminUsers).values({ name: "Admin", email: adminEmail, role: "admin" });
    const fourth = await runCreateOwner([`quarto-${crypto.randomUUID()}@exemplo.com`]);
    assert.equal(fourth.code, 1);
    assert.match(fourth.stderr, /already has 3 owners/);
    const promoted = await runCreateOwner([adminEmail, "--force"]);
    assert.equal(promoted.code, 1);
    assert.match(promoted.stderr, /not promoted/);
  });

  test("concurrent commands cannot reserve more than the last free owner seat", async () => {
    await db.delete(schema.adminInvitations);
    await db.delete(schema.adminUsers);
    for (const index of [1, 2]) {
      await db.insert(schema.adminUsers).values({
        name: `Owner ${index}`,
        email: `owner-${index}@example.com`,
        role: "owner",
      });
    }
    // Slow writes expose a check-then-insert race across independent CLI processes.
    await db.execute(sql`
      create function delay_owner_invitation() returns trigger language plpgsql as $$
      begin perform pg_sleep(0.5); return NEW; end $$
    `);
    await db.execute(sql`
      create trigger delay_owner_invitation before insert on admin_invitations
      for each row execute function delay_owner_invitation()
    `);
    try {
      const results = await Promise.all(
        Array.from({ length: 4 }, (_, index) =>
          runCreateOwner([`concurrent-owner-${index}@example.com`]),
        ),
      );
      assert.equal(results.filter((result) => result.code === 0).length, 1);
      assert.equal(results.filter((result) => result.code === 1).length, 3);
      for (const result of results.filter((attempt) => attempt.code !== 0)) {
        assert.match(result.stderr, /already has 3 owners/);
      }
    } finally {
      await db.execute(sql`drop trigger delay_owner_invitation on admin_invitations`);
      await db.execute(sql`drop function delay_owner_invitation()`);
    }
  });
});
