import { RouterContextProvider } from "react-router";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, describe, expect, test, vi } from "vitest";
import * as schema from "@/server/db/schema";
import type * as RequestContext from "@/server/request-context.server";
import { verifiedParticipant } from "./support/accounts";

/** Old or broken invitation links: a real 404, on the page they belong to. */
const requestHeaders = { current: new Headers() };
vi.mock("@/server/request-context.server", async (importOriginal) => ({
  ...(await importOriginal<typeof RequestContext>()),
  requestMemo: (load: () => unknown) => load,
  requestHeaders: () => requestHeaders.current,
}));

const friendLink = await import("@/app/routes/friend-link");
const { getUserAuth } = await import("@/features/auth/server/participant-auth.server");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
afterAll(() => pool.end());
const handler = (request: Request) => getUserAuth().handler(request);
const teamInvite = await import("@/app/routes/workspace/invitation");

function args(path: string, token: string) {
  const request = new Request(`http://localhost:3000${path}`);
  return {
    request,
    params: { token },
    context: new RouterContextProvider(),
    url: new URL(request.url),
    pattern: path,
  };
}

/** The HTTP status a loader result carries (200 when it is plain data). */
async function statusOf(run: () => unknown): Promise<number> {
  const result: unknown = await Promise.resolve()
    .then(run)
    .catch((thrown: unknown) => thrown);
  // A thrown response (the generic 404 page, a redirect) is not the page itself.
  if (result instanceof Response) return -1;
  if (typeof result === "object" && result !== null && "init" in result) {
    const init: unknown = result.init;
    if (typeof init === "object" && init !== null && "status" in init) return Number(init.status);
  }
  return 200;
}

describe("broken invitation links", () => {
  test("a friend link that does not work answers 404", async () => {
    expect(await statusOf(() => friendLink.loader(args("/amigo/xyz", "xyz")))).toBe(404);
  });

  test("a team invitation with a broken token answers 404 on the invitation page", async () => {
    const ana = await verifiedParticipant(db, handler, { name: "Ana" });
    requestHeaders.current = new Headers({ cookie: ana.jar.header(), "user-agent": "vitest" });
    expect(await statusOf(() => teamInvite.loader(args("/times/convite/xyz", "xyz")))).toBe(404);
  });
});
