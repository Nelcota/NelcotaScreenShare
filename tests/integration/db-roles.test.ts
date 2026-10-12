import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * The other tests run as superuser. Here operations run with the app's role
 * (nelcota_app), with the same grants as deploy/postgres/bootstrap.sql:
 * a migration that forgets the GRANT or the REVOKE shows up here, not in production.
 */
const client = new Client({ connectionString: process.env.DATABASE_URL });

beforeAll(async () => {
  await client.connect();
  // Cluster role: created if missing (CI); in the dev Postgres it already exists.
  await client.query(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nelcota_app') THEN
      CREATE ROLE nelcota_app NOLOGIN;
    END IF;
  END $$`);
  // Same excerpt as bootstrap.sql (general grants + REVOKE on insert-only tables).
  await client.query(`
    GRANT USAGE ON SCHEMA public TO nelcota_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO nelcota_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO nelcota_app;
    REVOKE CREATE ON SCHEMA public FROM PUBLIC;
    REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM nelcota_app;
    REVOKE UPDATE, TRUNCATE ON token_requests FROM nelcota_app;
    REVOKE UPDATE, TRUNCATE ON livekit_events FROM nelcota_app;
    GRANT UPDATE (processed_at, error) ON livekit_events TO nelcota_app;
  `);
  await client.query("SET ROLE nelcota_app");
});

afterAll(async () => {
  await client.query("RESET ROLE");
  await client.end();
});

/** The error message of the statement, or null when it succeeds. */
async function errorOf(statement: string, values: unknown[] = []): Promise<string | null> {
  await client.query("SAVEPOINT attempt");
  try {
    await client.query(statement, values);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  } finally {
    await client.query("ROLLBACK TO SAVEPOINT attempt");
  }
}

describe("app role in Postgres", () => {
  it("writes pilot tables and enforces the deferred team-owner constraint as the runtime role", async () => {
    await client.query("BEGIN");
    try {
      const person = await client.query<{ id: string }>(
        "insert into users(name,email) values ('Workspace runtime','workspace-runtime@example.com') returning id",
      );
      const userId = person.rows[0]?.id;
      const team = await client.query<{ id: string }>(
        "insert into teams(name) values('Runtime team') returning id",
      );
      const teamId = team.rows[0]?.id;
      await client.query("insert into team_members(team_id,user_id,role) values($1,$2,'owner')", [
        teamId,
        userId,
      ]);
      await client.query("insert into pro_entitlements(team_id,active) values($1,true)", [teamId]);
      const room = await client.query<{ id: string }>(
        "insert into room_definitions(code,kind,name,team_id,allow_guests) values('runtime-workspace','team','Runtime room',$1,false) returning id",
        [teamId],
      );
      const roomId = room.rows[0]?.id;
      await client.query("insert into room_favorites(user_id,room_id) values($1,$2)", [
        userId,
        roomId,
      ]);
      const call = await client.query<{ id: string }>(
        "insert into room_sessions(definition_id,media_room_name,host_user_id) values($1,'runtime-media',$2) returning id",
        [roomId, userId],
      );
      await client.query(
        "insert into annotation_epochs(session_id,track_sid,epoch,fingerprint) values($1,'TR_runtime',uuidv7(),'1280x720')",
        [call.rows[0]?.id],
      );
      await client.query("SET CONSTRAINTS ALL IMMEDIATE");
      expect(await errorOf("delete from team_members where team_id = $1", [teamId])).toMatch(
        /exactly one owner/,
      );
      expect(
        (await client.query("select * from team_members where team_id = $1", [teamId])).rows,
      ).toHaveLength(1);
    } finally {
      await client.query("ROLLBACK");
    }
  });
  it("anonymizes webhook names through the trigger without granting event-body updates", async () => {
    await client.query("BEGIN");
    try {
      const account = await client.query<{ id: string }>(
        "insert into users (name, email) values ('Original', 'redaction@exemplo.com') returning id",
      );
      const id = account.rows[0]?.id;
      expect(id).toBeDefined();
      const payload = { participant: { identity: id, sid: "PA_redaction", name: "Original" } };
      await client.query(
        "insert into livekit_events (id, event, payload, occurred_at) values ('EV_before_redaction', 'participant_joined', $1, now())",
        [JSON.stringify(payload)],
      );
      await client.query("update users set anonymized_at = now() where id = $1", [id]);
      await client.query(
        "insert into livekit_events (id, event, payload, occurred_at) values ('EV_after_redaction', 'participant_left', $1, now())",
        [JSON.stringify(payload)],
      );
      const events = await client.query<{ name: string | null; identity: string }>(
        "select payload->'participant'->>'name' as name, payload->'participant'->>'identity' as identity from livekit_events where id in ('EV_before_redaction', 'EV_after_redaction')",
      );
      expect(events.rows).toEqual([
        { name: null, identity: id },
        { name: null, identity: id },
      ]);
      expect(await errorOf("update livekit_events set payload = '{}'")).toMatch(
        /permission denied/,
      );
    } finally {
      await client.query("ROLLBACK");
    }
  });
  it("reads and writes regular data", async () => {
    await client.query("BEGIN");
    try {
      const room = await client.query<{ id: string }>(
        "insert into rooms (code) values ('papel-app') returning id",
      );
      expect(room.rows).toHaveLength(1);
      await client.query("update rooms set note = 'ok' where code = 'papel-app'");
      await client.query(
        "insert into token_requests (room_code, result) values ('papel-app', 'granted')",
      );
      await client.query(
        "insert into livekit_events (id, event, payload, occurred_at) values ('EV_papel', 'room_started', '{}', now())",
      );
      await client.query("update livekit_events set processed_at = now() where id = 'EV_papel'");
    } finally {
      await client.query("ROLLBACK");
    }
  });

  it("cannot change audit logs, token requests or event bodies, and cannot run DDL", async () => {
    await client.query("BEGIN");
    try {
      expect(await errorOf("update audit_logs set action = action")).toMatch(/permission denied/);
      expect(await errorOf("delete from audit_logs")).toMatch(/permission denied/);
      expect(await errorOf("update token_requests set result = result")).toMatch(
        /permission denied/,
      );
      expect(await errorOf("update livekit_events set payload = '{}'")).toMatch(
        /permission denied/,
      );
      expect(await errorOf("create table invasora (id int)")).toMatch(/permission denied/);
    } finally {
      await client.query("ROLLBACK");
    }
  });
});
