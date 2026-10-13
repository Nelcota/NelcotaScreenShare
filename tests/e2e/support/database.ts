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

/** A room owned by the account with `email`, as "Criar sala" leaves it for its creator. */
export async function ownedRoom(code: string, email: string): Promise<string> {
  await sql(
    `with owner as (select id from users where email = $2)
     insert into room_definitions (code, owner_user_id) select $1, id from owner`,
    [code, email],
  );
  await sql(
    `insert into room_roles (room_code, user_id, role)
     select $1, id, 'owner' from users where email = $2`,
    [code, email],
  );
  return code;
}
