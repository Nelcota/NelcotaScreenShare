import { beforeEach, describe, expect, test, vi } from "vitest";

/**
 * better-auth's `twoFactor()` shares one schema object between calls. Each auth instance
 * must keep its own 2FA table whatever order they are created in.
 */
beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("DATABASE_URL", "postgres://app:password@127.0.0.1:1/nelcota");
  vi.stubEnv("LIVEKIT_API_KEY", "test-key");
  vi.stubEnv("LIVEKIT_API_SECRET", "test-livekit-secret-0123456789abcdef");
  vi.stubEnv("LIVEKIT_URL", "wss://lk.example.com");
  vi.stubEnv("AUTH_SECRET", "test-auth-secret-0123456789abcdef-participants");
  vi.stubEnv("ADMIN_AUTH_SECRET", "test-admin-secret-0123456789abcdef-panel-only");
  vi.stubEnv("APP_URL", "http://localhost:3000");
});

interface PluginWithSchema {
  id: string;
  schema?: { twoFactor?: { modelName?: string } };
}

function twoFactorModel(auth: { options: { plugins?: unknown[] } } | undefined) {
  const plugins = (auth?.options.plugins ?? []) as PluginWithSchema[];
  return plugins.find((plugin) => plugin.id === "two-factor")?.schema?.twoFactor?.modelName;
}

async function instances() {
  const admin = await import("@/features/auth/server/admin-auth.server");
  const participant = await import("@/features/auth/server/participant-auth.server");
  return { admin, participant };
}

// Each test re-imports both auth modules from scratch; on a loaded machine that alone can
// take longer than the default 5 s.
describe("2FA tables per auth instance", { timeout: 30_000 }, () => {
  test("admin created first", async () => {
    const { admin, participant } = await instances();
    const adminAuth = admin.getAdminAuth();
    const userAuth = participant.getUserAuth();
    expect(twoFactorModel(adminAuth)).toBe("adminTwoFactors");
    expect(twoFactorModel(userAuth)).toBe("userTwoFactors");
  });

  test("participant created first", async () => {
    const { admin, participant } = await instances();
    const userAuth = participant.getUserAuth();
    const adminAuth = admin.getAdminAuth();
    expect(twoFactorModel(userAuth)).toBe("userTwoFactors");
    expect(twoFactorModel(adminAuth)).toBe("adminTwoFactors");
  });
});
