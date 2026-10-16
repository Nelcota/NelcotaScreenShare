import { APIError } from "better-auth/api";
import { getUserAuth } from "@/features/auth/server/participant-auth.server";
import { requestHeaders } from "@/server/request-context.server";

/** The six digits of the authenticator app; anything else is read as a backup code. */
const APP_CODE = /^\d{6}$/;

/**
 * Whether the signed-in person typed a valid second-factor code: from the authenticator app,
 * or a backup code, which is used up. Better Auth checks it against the current session.
 */
export async function secondFactorMatches(code: string): Promise<boolean> {
  const api = getUserAuth().api;
  const headers = requestHeaders();
  try {
    if (APP_CODE.test(code)) await api.verifyTOTP({ body: { code }, headers });
    if (!APP_CODE.test(code)) {
      await api.verifyBackupCode({ body: { code, disableSession: true }, headers });
    }
    return true;
  } catch (error) {
    if (error instanceof APIError) return false;
    throw error;
  }
}
