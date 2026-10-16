import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { defineConfig, devices } from "@playwright/test";
import { E2E_ACCESS_PASSWORD, E2E_PORT, E2E_URL } from "./tests/e2e/support/env";

/**
 * E2E of the critical flows (docs/archive/refactor/04-migration-plan.md §1).
 * Needs the development Postgres and LiveKit (docs/development.md).
 * The app uses E2E_PORT (3100 by default) and its own database (nelcota_e2e), recreated on every run.
 */
const local = existsSync(".env.local") ? parseEnv(readFileSync(".env.local", "utf8")) : {};
const env = { ...local, ...process.env };
// The global-setup (same process) recreates the E2E database from this URL.
process.env.TEST_DATABASE_URL ??= local.TEST_DATABASE_URL;

function e2eDatabaseUrl(): string {
  const base = env.TEST_DATABASE_URL;
  if (!base) throw new Error("Set TEST_DATABASE_URL (test Postgres) to run the E2E.");
  const url = new URL(base);
  url.pathname = "/nelcota_e2e";
  return url.toString();
}

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "tests/e2e/global-setup.ts",
  // Real rooms on LiveKit: one test at a time keeps results predictable.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: E2E_URL,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
    permissions: ["microphone"],
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: [
            // Fake microphone and screen, without a permission dialog.
            "--use-fake-ui-for-media-stream",
            "--use-fake-device-for-media-stream",
            "--auto-select-desktop-capture-source=Entire screen",
            // Test browsers never play sound.
            "--mute-audio",
          ],
        },
      },
    },
  ],
  webServer: {
    command:
      process.env.E2E_DEV !== "true" ? "pnpm build && pnpm start" : `pnpm dev --port ${E2E_PORT}`,
    url: `${E2E_URL}/api/health`,
    timeout: 240_000,
    reuseExistingServer: false,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      HOST: "127.0.0.1",
      PORT: String(E2E_PORT),
      DATABASE_URL: e2eDatabaseUrl(),
      APP_URL: E2E_URL,
      AUTH_SECRET: "segredo-participantes-e2e-0123456789abcdef0123",
      ADMIN_AUTH_SECRET: "segredo-admin-e2e-0123456789abcdef0123456789",
      LIVEKIT_API_KEY: env.LIVEKIT_API_KEY ?? "devkey",
      LIVEKIT_API_SECRET: env.LIVEKIT_API_SECRET ?? "devsecret-0123456789abcdef0123456789abcdef",
      LIVEKIT_URL: env.LIVEKIT_URL ?? "ws://127.0.0.1:7880",
      ACCESS_PASSWORD: E2E_ACCESS_PASSWORD,
      MAX_PARTICIPANTS: "5",
      ROOM_HOST_CONTROLS_ENABLED: process.env.E2E_HOST_CONTROLS === "true" ? "true" : "false",
      REQUIRE_EMAIL_VERIFICATION: "false",
      LOG_LEVEL: "warn",
      SENTRY_DSN: "",
      PUBLIC_SENTRY_DSN: "",
      SMTP_URL: "smtp://127.0.0.1:9",
      MAIL_FROM: "Nelcota Teste <teste@exemplo.dev>",
    },
  },
});
