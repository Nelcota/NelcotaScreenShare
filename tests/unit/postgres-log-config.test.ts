import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

/** Slow statements are logged without their values: e-mails, searches and messages stay out. */
test("the Postgres config logs statements without parameter values", () => {
  const config = readFileSync("deploy/postgres/postgresql.conf", "utf8");
  const setting = (name: string) => new RegExp(String.raw`^${name}\s*=\s*0\b`, "m").test(config);
  expect(setting("log_parameter_max_length")).toBe(true);
  expect(setting("log_parameter_max_length_on_error")).toBe(true);
});
