import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL("./", import.meta.url));

// Only the test database matters from .env.local; the rest of the local environment
// must not influence the tests (they set their own variables).
if (!process.env.TEST_DATABASE_URL && existsSync(`${root}.env.local`)) {
  const local = parseEnv(readFileSync(`${root}.env.local`, "utf8"));
  if (local.TEST_DATABASE_URL) process.env.TEST_DATABASE_URL = local.TEST_DATABASE_URL;
}

if (!process.env.TEST_DATABASE_URL) {
  // Without the test database, integration tests do not run: warn instead of silently skipping.
  console.warn("[vitest] TEST_DATABASE_URL missing: only unit tests will run.");
}

/**
 * Two projects:
 * - `unit`: no database, always runs.
 * - `integration`: real Postgres. Only enabled with TEST_DATABASE_URL (a disposable
 *   database); each file gets a clean copy of a migrated template database.
 */
export default defineConfig({
  resolve: {
    alias: [{ find: /^@\//, replacement: root }],
  },
  test: {
    // Logs only clutter the test output (logger spies keep working).
    env: { LOG_LEVEL: "silent" },
    restoreMocks: true,
    unstubEnvs: true,
    projects: [
      {
        extends: true,
        test: { name: "unit", include: ["tests/unit/**/*.test.ts"], environment: "node" },
      },
      ...(process.env.TEST_DATABASE_URL
        ? [
            {
              extends: true,
              test: {
                name: "integration",
                include: ["tests/integration/**/*.test.ts"],
                environment: "node",
                globalSetup: ["tests/integration/global-setup.ts"],
                setupFiles: ["tests/integration/file-setup.ts"],
                // The local Postgres mirrors production (max_connections = 50) and is shared by
                // every chat, app and E2E run on the machine. Each worker holds the app pool (up to
                // 5) plus the test's own: more workers ran out of connections under load.
                maxWorkers: 4,
                // A different worker limit needs its own group: unit tests run first.
                sequence: { groupOrder: 1 },
                testTimeout: 20_000,
                hookTimeout: 60_000,
              },
            },
          ]
        : []),
    ],
    coverage: {
      provider: "v8",
      include: ["server/**", "features/**", "lib/**", "components/**", "app/routes/api/**"],
      exclude: ["components/ui/**"],
      reporter: ["text-summary", "html", "json-summary"],
      // Ratchet: the minimum only goes up. Values from the refactor baseline (unit + integration).
      thresholds: { statements: 34, branches: 29, functions: 28, lines: 35 },
    },
  },
});
