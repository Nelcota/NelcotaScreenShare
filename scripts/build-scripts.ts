/**
 * Bundles the terminal scripts (migrate, create-owner, seed) into single files in `dist/`,
 * the ones copied into the Docker image. The integration test builds the same bundles.
 *
 * Usage: node scripts/build-scripts.ts [migrate]
 */
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build, type BuildOptions } from "esbuild";

/**
 * CommonJS dependencies call `require`, which ESM bundles lack. The import gets its own
 * name: bundled modules (the server logger) import `createRequire` themselves.
 */
const REQUIRE_BANNER =
  "import { createRequire as createRequireForBundle } from 'node:module'; const require = createRequireForBundle(import.meta.url);";

const shared: BuildOptions = {
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node26",
  logLevel: "warning",
};

export async function buildMigrate(outdir: string): Promise<void> {
  await build({
    ...shared,
    entryPoints: ["scripts/migrate.ts"],
    outfile: join(outdir, "migrate.mjs"),
    external: ["pg-native"],
    banner: { js: REQUIRE_BANNER },
  });
}

export async function buildCreateOwner(outdir: string): Promise<void> {
  await build({
    ...shared,
    entryPoints: ["scripts/create-owner.ts"],
    outfile: join(outdir, "create-owner.mjs"),
    external: ["pg-native", "@node-rs/argon2", "pg", "pino"],
    banner: { js: REQUIRE_BANNER },
  });
}

export async function buildSeed(outdir: string): Promise<void> {
  await build({
    ...shared,
    entryPoints: ["scripts/seed.ts"],
    outfile: join(outdir, "seed.mjs"),
    packages: "external",
  });
}

const isEntryPoint = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntryPoint) {
  const outdir = join(process.cwd(), "dist");
  await buildMigrate(outdir);
  if (process.argv[2] !== "migrate") {
    await Promise.all([buildCreateOwner(outdir), buildSeed(outdir)]);
  }
}
