import { adminQuery, ident, testDatabases } from "./db";

/**
 * Before each test file: a clean copy of the template database for this worker
 * (CREATE DATABASE … TEMPLATE is fast and isolates files from each other).
 */
const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("Integration tests require TEST_DATABASE_URL");

const { adminUrl, template, worker, workerUrl } = testDatabases(
  url,
  process.env.VITEST_POOL_ID ?? "0",
);
await adminQuery(adminUrl, [
  `DROP DATABASE IF EXISTS ${ident(worker)} WITH (FORCE)`,
  `CREATE DATABASE ${ident(worker)} TEMPLATE ${ident(template)}`,
]);

// The app code reads the database and keys from here.
Object.assign(process.env, {
  DATABASE_URL: workerUrl,
  LIVEKIT_API_KEY: "chave-teste",
  LIVEKIT_API_SECRET: "segredo-de-teste-0123456789abcdef0123456789",
  LIVEKIT_URL: "ws://127.0.0.1:7880",
  AUTH_SECRET: "segredo-participantes-de-teste-0123456789abcdef",
  // The requests in these tests use this origin; it no longer matches the dev default.
  APP_URL: "http://localhost:3000",
  // The account tests cover the full flow (with the link); the no-verification
  // mode has its own file (email-verification-off.test.ts).
  REQUIRE_EMAIL_VERIFICATION: "true",
});
