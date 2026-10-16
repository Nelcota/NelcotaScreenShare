const TWO_FACTOR_PATH = "/entrar/2fa";

function asksForCode(result: unknown): boolean {
  if (!result || typeof result !== "object") return false;
  return "twoFactorRedirect" in result && result.twoFactorRedirect === true;
}

/**
 * The 2FA code page when the sign-in asks for it, keeping where to go back to (?voltar=);
 * null when the account is already in. The form navigates there inside the app, so a call
 * going on survives.
 */
export function twoFactorStep(result: unknown, back: string | null): string | null {
  if (!asksForCode(result)) return null;
  if (!back) return TWO_FACTOR_PATH;
  return `${TWO_FACTOR_PATH}?voltar=${encodeURIComponent(back)}`;
}
