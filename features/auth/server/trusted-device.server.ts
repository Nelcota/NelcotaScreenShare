import { APIError } from "better-auth/api";
import { like } from "drizzle-orm";
import type { Database } from "@/server/db/index.server";
import { adminVerifications } from "@/server/db/schema";

const SIGN_IN_PATH = "/sign-in/email";
const SECOND_FACTOR_PATHS = new Set([
  "/two-factor/verify-totp",
  "/two-factor/verify-backup-code",
  "/two-factor/verify-otp",
]);
// The two-factor plugin stores each trusted device under this identifier prefix.
const TRUSTED_DEVICE_IDENTIFIERS = "trust-device-%";

function asksToTrustDevice(body: unknown): boolean {
  return (
    typeof body === "object" && body !== null && "trustDevice" in body && Boolean(body.trustDevice)
  );
}

/**
 * The panel asks for the second factor on every sign-in. Better Auth's "trust this device"
 * (a 30-day cookie that skips 2FA) is refused, and any device trusted before is forgotten
 * at sign-in, so an old cookie no longer skips the code.
 */
export async function requireSecondFactorEverySignIn(db: Database, path: string, body: unknown) {
  if (SECOND_FACTOR_PATHS.has(path) && asksToTrustDevice(body)) {
    throw new APIError("BAD_REQUEST", {
      code: "TRUST_DEVICE_DISABLED",
      message: "O painel pede o código em todo login.",
    });
  }
  if (path !== SIGN_IN_PATH) return;
  await db
    .delete(adminVerifications)
    .where(like(adminVerifications.identifier, TRUSTED_DEVICE_IDENTIFIERS));
}
