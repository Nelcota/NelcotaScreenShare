import { beforeEach, expect, test, vi } from "vitest";
import { buildCsp } from "@/server/csp.server";

/** Where attachments are stored, picked from the environment at boot (ADR 0011). */
const ACCOUNT_ID = "0123456789abcdef0123456789abcdef";
const BUCKET_ORIGIN = `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`;

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
  vi.stubEnv("ATTACHMENTS_STORAGE", "");
  vi.stubEnv("R2_ACCOUNT_ID", "");
  vi.stubEnv("R2_ACCESS_KEY_ID", "");
  vi.stubEnv("R2_SECRET_ACCESS_KEY", "");
  vi.stubEnv("R2_BUCKET", "");
});

function stubR2() {
  vi.stubEnv("ATTACHMENTS_STORAGE", "r2");
  vi.stubEnv("R2_ACCOUNT_ID", ACCOUNT_ID);
  vi.stubEnv("R2_ACCESS_KEY_ID", "access-key");
  vi.stubEnv("R2_SECRET_ACCESS_KEY", "secret-key");
  vi.stubEnv("R2_BUCKET", "nelcota-attachments");
}

test("with ATTACHMENTS_STORAGE=r2, every R2 variable is required at boot", async () => {
  stubR2();
  vi.stubEnv("R2_BUCKET", "");
  vi.stubEnv("R2_SECRET_ACCESS_KEY", "");
  const env = await import("@/server/env.server");
  expect(env.getEnv).toThrow("R2_SECRET_ACCESS_KEY is required with ATTACHMENTS_STORAGE=r2");
  expect(env.getEnv).toThrow("R2_BUCKET is required with ATTACHMENTS_STORAGE=r2");
});

test("production without ATTACHMENTS_STORAGE keeps attachments off", async () => {
  const storage = await import("@/server/storage/attachment-storage.server");
  expect(storage.attachmentStorage()).toBeNull();
  expect(storage.localAttachmentStorage()).toBeNull();
  expect(storage.attachmentStorageOrigin()).toBeUndefined();
});

test("with R2, the bucket is the storage and its origin goes in the CSP", async () => {
  stubR2();
  const storage = await import("@/server/storage/attachment-storage.server");
  expect(storage.attachmentStorage()).not.toBeNull();
  expect(storage.localAttachmentStorage()).toBeNull();
  const origin = storage.attachmentStorageOrigin();
  expect(origin).toBe(BUCKET_ORIGIN);

  const csp = buildCsp({
    livekitUrl: "wss://lk.example.com",
    dev: false,
    nonce: "bm9uY2U=",
    fileStorageOrigin: origin,
  });
  expect(csp).toMatch(new RegExp(`connect-src [^;]*${BUCKET_ORIGIN.replaceAll(".", "\\.")}`));
  expect(csp).toMatch(new RegExp(`img-src [^;]*${BUCKET_ORIGIN.replaceAll(".", "\\.")}`));
});

test("without R2, the CSP does not open any storage origin", () => {
  const csp = buildCsp({ livekitUrl: "wss://lk.example.com", dev: false, nonce: "bm9uY2U=" });
  expect(csp).not.toMatch(/r2\.cloudflarestorage\.com/);
});
