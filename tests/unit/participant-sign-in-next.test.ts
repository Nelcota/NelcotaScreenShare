import { expect, test } from "vitest";
import { twoFactorStep } from "@/features/auth/domain/participant-sign-in-next";

/**
 * The 2FA step used to be a full page load (window.location.assign), which ended a call
 * going on in the background. The form now navigates inside the app to this path.
 */
test("a sign-in that asks for the 2FA code goes to the code page with the way back", () => {
  expect(twoFactorStep({ twoFactorRedirect: true }, "/inicio")).toBe(
    "/entrar/2fa?voltar=%2Finicio",
  );
  expect(twoFactorStep({ twoFactorRedirect: true }, "/sala/kfa-mtrx-q2p")).toBe(
    "/entrar/2fa?voltar=%2Fsala%2Fkfa-mtrx-q2p",
  );
});

test("an account already in has no code step", () => {
  expect(twoFactorStep({ token: "t", user: {} }, "/inicio")).toBeNull();
  expect(twoFactorStep({ twoFactorRedirect: false }, "/inicio")).toBeNull();
  expect(twoFactorStep(null, "/inicio")).toBeNull();
});
