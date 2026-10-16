import assert from "node:assert/strict";
import { test } from "vitest";
import { searchable } from "@/lib/search-text";

test("a search ignores accents and case", () => {
  assert.equal(searchable("José Ávila"), "jose avila");
  assert.equal(searchable("SÃO PAULO"), "sao paulo");
  assert.ok(searchable("Conceição").includes(searchable("conceicao")));
});
