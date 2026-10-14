import { beforeEach, expect, test, vi } from "vitest";

/** Pages are never kept by caches, and production is HTTPS only. */
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

async function respond(response: Response) {
  const { requestMiddleware } = await import("@/server/middleware.server");
  const request = new Request("http://localhost:3000/conta");
  const result = await requestMiddleware(
    { request, params: {}, context: {} as never, url: new URL(request.url), pattern: "" },
    async () => response,
  );
  return (result as Response).headers;
}

const html = () => new Response("<p>conta</p>", { headers: { "Content-Type": "text/html" } });

test("a page is not stored by the browser or a shared cache", async () => {
  expect((await respond(html())).get("Cache-Control")).toBe("private, no-store");
});

test("a response that chose its own caching keeps it", async () => {
  const sitemap = new Response("<urlset/>", {
    headers: { "Content-Type": "text/html", "Cache-Control": "public, max-age=3600" },
  });
  expect((await respond(sitemap)).get("Cache-Control")).toBe("public, max-age=3600");
  expect((await respond(Response.json({ ok: true }))).get("Cache-Control")).toBeNull();
});

test("HSTS only when the app is served over HTTPS", async () => {
  expect((await respond(html())).get("Strict-Transport-Security")).toBeNull();
  vi.stubEnv("APP_URL", "https://nelcota.example.com");
  vi.resetModules();
  expect((await respond(html())).get("Strict-Transport-Security")).toBe(
    "max-age=31536000; includeSubDomains",
  );
});
