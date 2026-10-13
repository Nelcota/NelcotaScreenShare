import { runMigrations } from "../../scripts/migrate";
import { adminQuery, dropWorkerDatabases, ident, testDatabases } from "./db";

/**
 * Once per run: recreates the template database and applies every migration to it.
 * As a bonus, this tests that migrations run from scratch.
 */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return;
  const { adminUrl, template, templateUrl } = testDatabases(url);
  await dropWorkerDatabases(adminUrl);
  await adminQuery(adminUrl, [
    `DROP DATABASE IF EXISTS ${ident(template)} WITH (FORCE)`,
    `CREATE DATABASE ${ident(template)}`,
  ]);
  await runMigrations(templateUrl);
}
