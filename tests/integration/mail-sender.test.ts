import assert from "node:assert/strict";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeEach, describe, test } from "vitest";
import * as schema from "@/server/db/schema";
import {
  clearSettingsCache,
  mailSenderSettings,
  saveSetting,
} from "@/features/admin/settings/server/settings.server";
import { currentMailSender } from "@/server/mail-sender.server";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
afterAll(() => pool.end());

describe("e-mail sender saved in the panel", () => {
  beforeEach(async () => {
    clearSettingsCache();
    await db.delete(schema.appSettings);
  });

  test("nothing saved: the hosting's MAIL_FROM, here none", async () => {
    assert.deepEqual(await currentMailSender(db), { value: null, fromPanel: false });
  });

  test("a saved sender is used for the next e-mail, trimmed", async () => {
    await saveSetting(mailSenderSettings, { sender: "  Nelcota <no-reply@nelcota.app> " }, db);
    assert.deepEqual(await currentMailSender(db), {
      value: "Nelcota <no-reply@nelcota.app>",
      fromPanel: true,
    });
  });

  test("a blank field goes back to the hosting's sender", async () => {
    await saveSetting(mailSenderSettings, { sender: "no-reply@nelcota.app" }, db);
    await saveSetting(mailSenderSettings, { sender: "   " }, db);
    assert.deepEqual(await currentMailSender(db), { value: null, fromPanel: false });
  });

  test("a malformed sender is refused and the saved one stays", async () => {
    await saveSetting(mailSenderSettings, { sender: "no-reply@nelcota.app" }, db);
    await assert.rejects(saveSetting(mailSenderSettings, { sender: "Nelcota sem email" }, db));
    assert.equal((await currentMailSender(db)).value, "no-reply@nelcota.app");
  });

  test("a value written from outside that no provider accepts is ignored", async () => {
    await pool.query(
      `insert into app_settings (key, value) values ('mail', '{"sender":"sem arroba"}')`,
    );
    assert.deepEqual(await currentMailSender(db), { value: null, fromPanel: false });
  });
});
