import assert from "node:assert/strict";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeEach, describe, test } from "vitest";
import * as schema from "@/server/db/schema";
import { isPanelMember } from "@/features/auth/server/panel-member.server";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
afterAll(() => pool.end());

async function teamMember(email: string, role: string, banned = false) {
  await db.insert(schema.adminUsers).values({ name: email, email, role, banned });
}

describe("Abrir o painel in Configurações", () => {
  beforeEach(async () => {
    await db.delete(schema.adminUsers);
  });

  test("shows for a verified e-mail of someone active on the team, any role", async () => {
    await teamMember("dona@exemplo.com", "owner");
    await teamMember("leitor@exemplo.com", "viewer");
    assert.equal(await isPanelMember({ email: "dona@exemplo.com", emailVerified: true }, db), true);
    assert.equal(
      await isPanelMember({ email: "Leitor@Exemplo.com", emailVerified: true }, db),
      true,
    );
  });

  test("not for an e-mail that is not verified, even if it is on the team", async () => {
    await teamMember("dona@exemplo.com", "owner");
    assert.equal(
      await isPanelMember({ email: "dona@exemplo.com", emailVerified: false }, db),
      false,
    );
  });

  test("not for someone deactivated in Equipe", async () => {
    await teamMember("saiu@exemplo.com", "admin", true);
    assert.equal(
      await isPanelMember({ email: "saiu@exemplo.com", emailVerified: true }, db),
      false,
    );
  });

  test("not for an account outside the team, nor without an account", async () => {
    await teamMember("dona@exemplo.com", "owner");
    assert.equal(await isPanelMember({ email: "ana@exemplo.com", emailVerified: true }, db), false);
    assert.equal(await isPanelMember(null, db), false);
  });
});
