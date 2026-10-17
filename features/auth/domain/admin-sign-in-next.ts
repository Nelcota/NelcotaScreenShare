const ADMIN_TWO_FACTOR_PATH = "/admin/verificar-2fa";
const ADMIN_HOME_PATH = "/admin";

/**
 * Where the panel's sign-in goes next: the 2FA code when the answer asks for it, otherwise
 * the panel. The form navigates there inside the app, so a call going on survives.
 */
export function adminSignInNext(result: unknown): string {
  if (!result || typeof result !== "object") return ADMIN_HOME_PATH;
  if ("twoFactorRedirect" in result && result.twoFactorRedirect === true) {
    return ADMIN_TWO_FACTOR_PATH;
  }
  return ADMIN_HOME_PATH;
}
