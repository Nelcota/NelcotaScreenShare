import assert from "node:assert/strict";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, test } from "vitest";
import { recentErrors } from "@/features/admin/errors/server/queries.server";
import { recordAppError } from "@/server/app-errors.server";
import * as schema from "@/server/db/schema";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
afterAll(() => pool.end());

test("an unexpected error is kept as a safe summary and listed newest first", async () => {
  const request = new Request("http://localhost/admin/convite/ASEVtqrsxn_yJLqPzLY8lBfRoFzJ?a=1", {
    method: "POST",
    headers: { "x-request-id": "req-erro-1" },
  });
  await recordAppError(new Error("Failed query: insert into users\nparams: ana@b.co"), request);
  await recordAppError(new RangeError("too far"), new Request("http://localhost/admin/salas"));

  const { latest, lastDay } = await recentErrors(db);
  assert.equal(lastDay, 2);
  assert.deepEqual(
    latest.map(({ requestId, method, path, name, message }) => ({
      requestId,
      method,
      path,
      name,
      message,
    })),
    [
      {
        requestId: null,
        method: "GET",
        path: "/admin/salas",
        name: "RangeError",
        message: "too far",
      },
      {
        requestId: "req-erro-1",
        method: "POST",
        path: "/admin/convite/:id",
        name: "Error",
        message: "Falha numa consulta ao banco",
      },
    ],
  );
});
