import assert from "node:assert/strict";
import { test } from "vitest";
import { safePath, summarizeError } from "@/features/admin/errors/domain/error-summary";
import { sentryLink } from "@/features/admin/errors/server/queries.server";

test("error summaries keep query parameters and e-mails out", () => {
  const query = new Error("Failed query: select * from users where email = $1\nparams: a@b.co");
  assert.deepEqual(summarizeError(query), {
    name: "Error",
    message: "Falha numa consulta ao banco",
  });
  assert.deepEqual(summarizeError(new TypeError("no user ana@exemplo.com\nstack")), {
    name: "TypeError",
    message: "no user [e-mail]",
  });
  assert.equal(summarizeError(new Error("x".repeat(500))).message.length, 200);
  assert.deepEqual(summarizeError("boom"), { name: "Erro", message: "boom" });
});

test("paths drop the query string and mask tokens", () => {
  assert.equal(
    safePath("http://localhost/admin/convite/ASEVtqrsxn_yJLqPzLY8lBfRoFzJ_tX0f?x=1"),
    "/admin/convite/:id",
  );
  assert.equal(safePath("http://localhost/sala/abc-def?token=secret"), "/sala/abc-def");
});

test("the Sentry link filters by request id, only when configured", () => {
  assert.equal(
    sentryLink("https://nelcota.sentry.io/issues/?project=12", "req-1"),
    "https://nelcota.sentry.io/issues/?project=12&query=request_id%3Areq-1",
  );
  assert.equal(sentryLink(undefined, "req-1"), null);
  assert.equal(sentryLink("https://nelcota.sentry.io/issues/", null), null);
});
