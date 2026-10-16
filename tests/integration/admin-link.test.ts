import assert from "node:assert/strict";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeEach, describe, test } from "vitest";
import * as schema from "@/server/db/schema";
import { MAX_ADMIN_LINKS } from "@/features/admin/participants/domain/admin-link";
import { hasAdminLink, setAdminLink } from "@/features/admin/settings/server/admin-link.server";
import {
  adminLinkSettings,
  clearSettingsCache,
  saveSetting,
} from "@/features/admin/settings/server/settings.server";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
afterAll(() => pool.end());

const ANA = "01a1453b-cb0f-725d-bde7-1ea89ef03e77";
const BIA = "01a1453b-cb55-7401-9fcf-91fcb89cc79c";

/** The owner who changes the list (app_settings.updated_by points at a panel account). */
async function ownerId(): Promise<string> {
  const [owner] = await db
    .insert(schema.adminUsers)
    .values({ name: "Dono", email: `dono-${crypto.randomUUID()}@exemplo.dev` })
    .returning({ id: schema.adminUsers.id });
  if (!owner) throw new Error("owner not created");
  return owner.id;
}

describe("panel link in Configurações", () => {
  beforeEach(async () => {
    clearSettingsCache();
    await db.delete(schema.appSettings);
  });

  test("nobody sees it until the owner picks the account", async () => {
    assert.equal(await hasAdminLink(ANA, db), false);
  });

  test("only the picked accounts see it", async () => {
    await saveSetting(adminLinkSettings, { userIds: [ANA] }, db);
    clearSettingsCache();
    assert.equal(await hasAdminLink(ANA, db), true);
    assert.equal(await hasAdminLink(BIA, db), false);
  });

  test("ids that are not accounts and lists past the limit are refused", async () => {
    await assert.rejects(saveSetting(adminLinkSettings, { userIds: ["ana"] }, db));
    const tooMany = Array.from({ length: MAX_ADMIN_LINKS + 1 }, () => crypto.randomUUID());
    await assert.rejects(saveSetting(adminLinkSettings, { userIds: tooMany }, db));
  });

  test("a value written from outside that does not fit shows the link to nobody", async () => {
    await pool.query(
      `insert into app_settings (key, value) values ('admin_link', '{"userIds":"todos"}')`,
    );
    clearSettingsCache();
    assert.equal(await hasAdminLink(ANA, db), false);
  });
});

describe("two owners changing the list at once", () => {
  beforeEach(async () => {
    clearSettingsCache();
    await db.delete(schema.appSettings);
  });

  test("both changes stay", async () => {
    const owner = await ownerId();
    await Promise.all([
      db.transaction((tx) => setAdminLink(tx, ANA, true, owner)),
      db.transaction((tx) => setAdminLink(tx, BIA, true, owner)),
    ]);
    clearSettingsCache();
    assert.equal(await hasAdminLink(ANA, db), true);
    assert.equal(await hasAdminLink(BIA, db), true);
  });

  test("turning one off keeps the other", async () => {
    const owner = await ownerId();
    await db.transaction((tx) => setAdminLink(tx, ANA, true, owner));
    await Promise.all([
      db.transaction((tx) => setAdminLink(tx, ANA, false, owner)),
      db.transaction((tx) => setAdminLink(tx, BIA, true, owner)),
    ]);
    clearSettingsCache();
    assert.equal(await hasAdminLink(ANA, db), false);
    assert.equal(await hasAdminLink(BIA, db), true);
  });
});
