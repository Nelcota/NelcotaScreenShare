import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

/** What a local storage link allows: sending one object or fetching it. */
export type StorageAction = "upload" | "download";

export interface StorageGrant {
  action: StorageAction;
  key: string;
  /** Only uploads carry it: the name the download will use. */
  fileName?: string;
  expiresAt: number;
}

function signature(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(`storage-link:${payload}`).digest("base64url");
}

/** A token for one action on one object, valid until `expiresAt`. */
export function signStorageGrant(secret: string, grant: StorageGrant): string {
  const payload = Buffer.from(JSON.stringify(grant)).toString("base64url");
  return `${payload}.${signature(secret, payload)}`;
}

const grantSchema = z.object({
  action: z.enum(["upload", "download"]),
  key: z.string(),
  fileName: z.string().optional(),
  expiresAt: z.number(),
});

function parseGrant(payload: string): StorageGrant | null {
  try {
    const parsed = grantSchema.safeParse(JSON.parse(Buffer.from(payload, "base64url").toString()));
    return parsed.success ? parsed.data : null;
  } catch {
    // Not JSON: a forged or broken token, refused like any other.
    return null;
  }
}

/** The grant, only if signed with this secret, for this action and not expired. */
export function verifyStorageGrant(
  token: string,
  secret: string,
  action: StorageAction,
  now: number = Date.now(),
): StorageGrant | null {
  const [payload, given] = token.split(".");
  if (payload === undefined || given === undefined) return null;
  const expected = Buffer.from(signature(secret, payload));
  const received = Buffer.from(given);
  if (expected.length !== received.length) return null;
  if (!timingSafeEqual(expected, received)) return null;
  const grant = parseGrant(payload);
  if (grant === null) return null;
  if (grant.action !== action) return null;
  if (grant.expiresAt <= now) return null;
  return grant;
}
