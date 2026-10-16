import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { expect, test } from "vitest";

const run = promisify(execFile);

/**
 * The gate serves Coolify over a Unix socket (`socketserver.UnixStreamServer`), which only
 * exists on Linux and macOS. CI and the production host run it; a Windows checkout skips it.
 */
const unixSockets = process.platform !== "win32";

test.runIf(unixSockets)(
  "Coolify gate blocks backup, migration and transport failures",
  async () => {
    const { stderr } = await run("python3", ["deploy/coolify/test_gate.py", "-v"], {
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
    });
    expect(stderr).toContain("Ran 9 tests");
    expect(stderr).toContain("OK");
  },
);
