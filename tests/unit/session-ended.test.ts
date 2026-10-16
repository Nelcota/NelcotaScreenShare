import { expect, test } from "vitest";
import { sessionEndedHref } from "@/features/auth/domain/session-ended";

/** A session ended elsewhere turned the page into a visitor's, with no word. */
test("a session ended elsewhere leads to sign-in with the notice and the way back", () => {
  const href = new URL(sessionEndedHref("/sala/abc-defg-hij?atendeu=1"), "http://localhost");
  expect(href.pathname).toBe("/entrar");
  expect(href.searchParams.get("aviso")).toBe("encerrada");
  expect(href.searchParams.get("voltar")).toBe("/sala/abc-defg-hij?atendeu=1");
});
