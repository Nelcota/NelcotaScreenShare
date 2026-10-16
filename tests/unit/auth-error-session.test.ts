import { expect, test } from "vitest";
import { authErrorMessage, SESSION_EXPIRED_MESSAGE } from "@/features/auth/domain/auth-errors";

/** A tab left open after signing out elsewhere: saving says why it failed. */
test("a 401 without a code reads as an expired session, not a generic error", () => {
  expect(authErrorMessage({ status: 401 })).toBe(SESSION_EXPIRED_MESSAGE);
  expect(authErrorMessage({ status: 401, code: "UNAUTHORIZED" })).toBe(SESSION_EXPIRED_MESSAGE);
  expect(authErrorMessage({ status: 401, code: "INVALID_EMAIL_OR_PASSWORD" })).toBe(
    "E-mail ou senha incorretos.",
  );
});
