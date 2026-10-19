import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * A short pass to the panel's sign-in, given when someone opens a valid invitation or
 * new-password link, so they can sign in right after without an app account on the team.
 */
export const ADMIN_PASS_COOKIE = "nelcota-admin-pass";
export const ADMIN_PASS_TTL_MS = 30 * 60 * 1000;

function signature(secret: string, expiresAt: number): string {
  return createHmac("sha256", secret).update(`admin-pass:${expiresAt}`).digest("base64url");
}

/** The cookie value: when it expires and the server's signature of it. */
export function signAdminPass(secret: string, now: number = Date.now()): string {
  const expiresAt = now + ADMIN_PASS_TTL_MS;
  return `${expiresAt}.${signature(secret, expiresAt)}`;
}

/** Valid only if signed with this secret and not expired. */
export function verifyAdminPass(
  value: string | undefined,
  secret: string,
  now: number = Date.now(),
): boolean {
  if (value === undefined || value.length === 0) return false;
  const [expires, given] = value.split(".");
  const expiresAt = Number(expires);
  if (given === undefined || given.length === 0) return false;
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now) return false;
  const expected = Buffer.from(signature(secret, expiresAt));
  const received = Buffer.from(given);
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}

/** Set-Cookie for the pass: only the server reads it, sent back to this site only. */
export function adminPassCookie(value: string, secure: boolean): string {
  const maxAge = Math.round(ADMIN_PASS_TTL_MS / 1000);
  const flags = [`Path=/`, `Max-Age=${maxAge}`, "HttpOnly", "SameSite=Lax"];
  if (secure) flags.push("Secure");
  return `${ADMIN_PASS_COOKIE}=${value}; ${flags.join("; ")}`;
}

/** One cookie's value from a request's Cookie header. */
export function readCookie(headers: Headers, name: string): string | undefined {
  const header = headers.get("cookie");
  if (header === null || header.length === 0) return undefined;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return undefined;
}
