import { expect, test } from "vitest";
import { adminSignInNext } from "@/features/auth/domain/admin-sign-in-next";

/**
 * The 2FA step used to be a full page load (window.location.assign), which ended a call
 * going on in the background. The form now navigates inside the app to this path.
 */
test("a sign-in that asks for the 2FA code goes to the code page", () => {
  expect(adminSignInNext({ twoFactorRedirect: true, twoFactorMethods: ["totp"] })).toBe(
    "/admin/verificar-2fa",
  );
});

test("any other answer goes to the panel", () => {
  expect(adminSignInNext({ token: "t", user: {} })).toBe("/admin");
  expect(adminSignInNext({ twoFactorRedirect: false })).toBe("/admin");
  expect(adminSignInNext(null)).toBe("/admin");
});
