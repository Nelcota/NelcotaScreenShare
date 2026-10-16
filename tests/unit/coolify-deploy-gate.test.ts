import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { expect, test } from "vitest";

const run = promisify(execFile);

test("Coolify gate blocks backup, migration and transport failures", async () => {
  const { stderr } = await run("python3", ["deploy/coolify/test_gate.py", "-v"], {
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
  });
  expect(stderr).toContain("Ran 9 tests");
  expect(stderr).toContain("OK");
});
