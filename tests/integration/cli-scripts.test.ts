import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { eq } from "drizzle-orm";
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
});
