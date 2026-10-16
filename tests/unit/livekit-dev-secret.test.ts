import { beforeEach, expect, test, vi } from "vitest";

/** The LiveKit keys from deploy/livekit/livekit.dev.yaml are public: never in production. */
const DEV_KEY = "devkey";
const DEV_SECRET = "devsecret-0123456789abcdef0123456789abcdef";

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("DATABASE_URL", "postgres://app:password@localhost/nelcota");
  vi.stubEnv("LIVEKIT_API_KEY", "prod-key");
  vi.stubEnv("LIVEKIT_API_SECRET", "prod-livekit-secret-0123456789abcdef");
  vi.stubEnv("LIVEKIT_URL", "wss://lk.example.com");
  vi.stubEnv("AUTH_SECRET", "test-auth-secret-0123456789abcdef");
  vi.stubEnv("ADMIN_AUTH_SECRET", "");
  vi.stubEnv("APP_URL", "https://app.example.com");
  vi.stubEnv("REQUIRE_EMAIL_VERIFICATION", "false");
  vi.stubEnv("RESEND_API_KEY", "");
  vi.stubEnv("SMTP_URL", "");
  vi.stubEnv("MAIL_FROM", "");
  vi.stubEnv("ROOM_HOST_CONTROLS_ENABLED", "false");
});

test("production refuses the development LiveKit key or secret", async () => {
  vi.stubEnv("LIVEKIT_API_SECRET", DEV_SECRET);
  const first = await import("@/server/env.server");
  expect(first.getEnv).toThrow("development LiveKit");

  vi.resetModules();
  vi.stubEnv("LIVEKIT_API_SECRET", "prod-livekit-secret-0123456789abcdef");
  vi.stubEnv("LIVEKIT_API_KEY", DEV_KEY);
  const second = await import("@/server/env.server");
  expect(second.getEnv).toThrow("development LiveKit");
});

test("the local production build of the E2E keeps the dev LiveKit", async () => {
  vi.stubEnv("APP_URL", "http://127.0.0.1:3100");
  vi.stubEnv("LIVEKIT_API_KEY", DEV_KEY);
  vi.stubEnv("LIVEKIT_API_SECRET", DEV_SECRET);
  const local = await import("@/server/env.server");
  expect(local.getEnv().LIVEKIT_API_KEY).toBe(DEV_KEY);
});

test("development keeps using them, and production its own keys", async () => {
  const production = await import("@/server/env.server");
  expect(production.getEnv().LIVEKIT_API_KEY).toBe("prod-key");

  vi.resetModules();
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("LIVEKIT_API_KEY", DEV_KEY);
  vi.stubEnv("LIVEKIT_API_SECRET", DEV_SECRET);
  const development = await import("@/server/env.server");
  expect(development.getEnv().LIVEKIT_API_SECRET).toBe(DEV_SECRET);
});
