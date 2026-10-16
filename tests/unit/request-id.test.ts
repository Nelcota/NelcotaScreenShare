import { beforeEach, expect, test, vi } from "vitest";

/** The audit, logs and errors tie a request together by an id the server chose. */
beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("DATABASE_URL", "postgres://app:password@127.0.0.1:1/nelcota");
  vi.stubEnv("LIVEKIT_API_KEY", "test-key");
  vi.stubEnv("LIVEKIT_API_SECRET", "test-livekit-secret-0123456789abcdef");
  vi.stubEnv("LIVEKIT_URL", "wss://lk.example.com");
  vi.stubEnv("AUTH_SECRET", "test-auth-secret-0123456789abcdef-participants");
  vi.stubEnv("APP_URL", "http://localhost:3000");
});

async function runMiddleware(headers: Record<string, string>) {
  const { requestMiddleware } = await import("@/server/middleware.server");
  const request = new Request("http://localhost:3000/", { headers });
  let seen: Headers | undefined;
  const response = await requestMiddleware(
    { request, params: {}, context: {} as never, url: new URL(request.url), pattern: "" },
    async () => {
      seen = new Headers(request.headers);
      return new Response("ok");
    },
  );
  return { seen, response: response as Response };
}

test("a request id sent by the client is not trusted as the request's id", async () => {
  const forged = "id-de-outra-requisicao-123";
  const { seen, response } = await runMiddleware({ "x-request-id": forged });
  const id = seen?.get("x-request-id");
  expect(id).toMatch(/^[0-9a-f-]{36}$/);
  expect(id).not.toBe(forged);
  expect(response.headers.get("x-request-id")).toBe(id);
  // Kept apart, for matching the proxy's own logs.
  expect(seen?.get("x-upstream-request-id")).toBe(forged);
});

test("without a client id, a new one is made and nothing upstream is recorded", async () => {
  const { seen } = await runMiddleware({});
  expect(seen?.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
  expect(seen?.get("x-upstream-request-id")).toBeNull();
});
