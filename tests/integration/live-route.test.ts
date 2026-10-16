import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, describe, expect, test, vi } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "@/server/db/schema";
import { userSessions, users } from "@/server/db/schema";
import { verifiedParticipant } from "./support/accounts";

/** GET /api/eventos: the live stream of a signed-in tab. */
const requestHeaders = { current: new Headers() };
vi.mock("@/server/request-context.server", () => ({
  requestMemo: (load: () => unknown) => load,
  requestHeaders: () => requestHeaders.current,
}));

const { openLiveStream } = await import("@/features/live/server/live-route.server");
const { createLiveBus } = await import("@/features/live/server/live-bus.server");
const { getUserAuth } = await import("@/features/auth/server/participant-auth.server");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
afterAll(() => pool.end());
const handler = (request: Request) => getUserAuth().handler(request);

function open(
  cookie: string | null,
  bus = createLiveBus(),
  keepAliveMs = 20,
  sessionCheckMs = 60_000,
) {
  requestHeaders.current = new Headers({ "user-agent": "vitest", ...(cookie ? { cookie } : {}) });
  const abort = new AbortController();
  const response = openLiveStream(
    new Request("http://localhost:3000/api/eventos", { signal: abort.signal }),
    bus,
    keepAliveMs,
    sessionCheckMs,
  );
  return { response, abort, bus };
}

/** Reads the stream until `expected` shows up. */
async function readUntil(body: ReadableStream<Uint8Array>, expected: string) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  while (!text.includes(expected)) {
    const { value, done } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  reader.releaseLock();
  return text;
}

describe("live stream", () => {
  test("refuses visitors", async () => {
    expect((await open(null).response).status).toBe(401);
  });

  test("streams nudges and keep-alives without compression or buffering", async () => {
    const ana = await verifiedParticipant(db, handler, { name: "Ana" });
    const { response, abort, bus } = open(ana.jar.header());
    const stream = await response;
    expect(stream.status).toBe(200);
    expect(stream.headers.get("content-type")).toMatch(/^text\/event-stream/);
    expect(stream.headers.get("cache-control")).toContain("no-transform");
    expect(stream.headers.get("x-accel-buffering")).toBe("no");
    const body = stream.body;
    if (!body) throw new Error("no body");
    expect(await readUntil(body, ": keep-alive")).toContain("retry: 5000");
    bus.notify([ana.id], "friends");
    expect(await readUntil(body, "data: friends")).toContain("event: nudge");
    bus.notify([ana.id], "ring", { id: "toque" });
    expect(await readUntil(body, "toque")).toContain(
      `event: data\ndata: {"topic":"ring","data":{"id":"toque"}}`,
    );
    expect(bus.streamCount(ana.id)).toBe(1);
    abort.abort();
    expect(bus.streamCount(ana.id)).toBe(0);
  });

  test.each([
    [
      "the session is revoked",
      (id: string) => db.delete(userSessions).where(eq(userSessions.userId, id)),
    ],
    [
      "the account is blocked",
      (id: string) => db.update(users).set({ blockedAt: new Date() }).where(eq(users.id, id)),
    ],
  ])("closes once %s", async (_, revoke) => {
    const ana = await verifiedParticipant(db, handler, { name: "Ana" });
    const { response, bus } = open(ana.jar.header(), createLiveBus(), 20, 30);
    const body = (await response).body;
    if (!body) throw new Error("no body");
    expect(await readUntil(body, ": keep-alive")).toContain("retry: 5000");
    await revoke(ana.id);
    // The tab is told why before the stream closes, so it can send the person to sign in.
    expect(await readToEnd(body)).toContain("event: session-ended");
    expect(bus.streamCount(ana.id)).toBe(0);
  });

  test("a session ended elsewhere closes the stream at once, not on the next check", async () => {
    const ana = await verifiedParticipant(db, handler, { name: "Ana" });
    const { response, bus } = open(ana.jar.header(), createLiveBus(), 20, 60_000);
    const body = (await response).body;
    if (!body) throw new Error("no body");
    await readUntil(body, ": keep-alive");
    // Still valid: the check passes and nothing reaches the page.
    bus.notify([ana.id], "session");
    expect(bus.streamCount(ana.id)).toBe(1);
    await db.delete(userSessions).where(eq(userSessions.userId, ana.id));
    bus.notify([ana.id], "session");
    const text = await readToEnd(body);
    expect(text).toContain("event: session-ended");
    expect(text).not.toContain("data: session");
  });
});

/** Reads until the stream closes (or gives up after a while). */
async function readToEnd(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  for (let reads = 0; reads < 200; reads++) {
    const { value, done } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  return text;
}
