import { Client } from "pg";
import { z } from "zod";
import type { Participant } from "./session";

export async function workspaceSql(text: string, values: unknown[] = []) {
  const base = process.env.TEST_DATABASE_URL;
  if (!base) throw new Error("Set TEST_DATABASE_URL to run workspace E2E");
  const url = new URL(base);
  url.pathname = "/nelcota_e2e";
  const client = new Client({ connectionString: url.href });
  await client.connect();
  try {
    return await client.query(text, values);
  } finally {
    await client.end();
  }
}
export async function pilotAccount(person: Participant) {
  const result = await workspaceSql(
    "update users set email_verified = true where email = $1 returning id",
    [person.email],
  );
  const id = z.object({ id: z.uuid() }).parse(result.rows[0]).id;
  await workspaceSql(
    "insert into pro_entitlements(user_id, active, room_limit) values($1,true,3)",
    [id],
  );
  return id;
}
export async function pilotTeam(teamId: string) {
  await workspaceSql(
    "insert into pro_entitlements(team_id, active, room_limit) values($1,true,3)",
    [teamId],
  );
}
