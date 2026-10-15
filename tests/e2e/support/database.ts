import { Client } from "pg";

/** The E2E app's database (recreated by global-setup on every run). */
function e2eDatabaseUrl(): string {
  const base = process.env.TEST_DATABASE_URL;
  if (!base) throw new Error("Set TEST_DATABASE_URL to run the E2E tests.");
  const url = new URL(base);
  url.pathname = "/nelcota_e2e";
  return url.toString();
}

export async function sql(text: string, values: unknown[] = []) {
  const client = new Client({ connectionString: e2eDatabaseUrl() });
  await client.connect();
  try {
    return await client.query(text, values);
  } finally {
    await client.end();
  }
}

/** A room as "Criar sala" leaves it, without an owner: tests that need one create it in the app. */
export async function createdRoom(code: string): Promise<string> {
  await sql("insert into room_definitions (code) values ($1) on conflict do nothing", [code]);
  return code;
}
