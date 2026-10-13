import { afterAll } from "vitest";
import { adminQuery, ident, testDatabases } from "./db";

/**
 * Before each test file: a clean copy of the template database (CREATE DATABASE …
 * TEMPLATE is fast and isolates files from each other). The name carries a per-file run
 * id besides the worker: under load a replacement worker can get the same pool id while
 * the old one is still running, and two files must never drop each other's copy.
 */
const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("Integration tests require TEST_DATABASE_URL");

const run = crypto.randomUUID().slice(0, 8);
const { adminUrl, template, worker, workerUrl } = testDatabases(
  url,
  `${process.env.VITEST_POOL_ID ?? "0"}_${run}`,
);
await adminQuery(adminUrl, [`CREATE DATABASE ${ident(worker)} TEMPLATE ${ident(template)}`]);

// Runs after the file's own hooks have closed their pools; FORCE ends any left open.
afterAll(() => adminQuery(adminUrl, [`DROP DATABASE IF EXISTS ${ident(worker)} WITH (FORCE)`]));

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
