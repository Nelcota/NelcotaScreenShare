import { expect, test } from "vitest";
import { loadAuditParams } from "@/features/admin/audit/domain/search-params";

test("opening the audit page or clearing its search produces an empty string", () => {
  expect(loadAuditParams(new URLSearchParams()).q).toBe("");
  expect(loadAuditParams(new URLSearchParams("acao=auth.sign_in")).q).toBe("");
  expect(loadAuditParams(new URLSearchParams("q=")).q).toBe("");
});
