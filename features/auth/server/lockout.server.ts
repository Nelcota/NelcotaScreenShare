import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { and, eq, gte, isNull, lt, sql } from "drizzle-orm";
import type { Database } from "@/server/db/index.server";
import { loginFailures } from "@/server/db/schema";

export type AuthScope = "admin" | "user";

/**
 * Lockout after wrong passwords (Better Auth only locks 2FA):
 * - per account and network (HMAC of the e-mail, and the IP, or its /64 for IPv6): every 5
 *   failures in 24 h the lockout doubles, starting at 15 min and going up to 24 h. Someone
 *   guessing from elsewhere never locks the owner out;
 * - per IP: 20 failures in 15 min lock the IP for 15 min.
 * The message for whoever is trying is always the same, whether the account exists or not.
 */
const LOCKOUT = {
  perAccount: 5,
  baseLockMs: 15 * 60 * 1000,
  maxLockMs: 24 * 60 * 60 * 1000,
  accountWindowMs: 24 * 60 * 60 * 1000,
  perIp: 20,
  ipWindowMs: 15 * 60 * 1000,
} as const;

export interface LockoutStatus {
  locked: boolean;
  retryAfterSeconds: number;
}

export function emailHash(secret: string, scope: AuthScope, email: string): string {
  return createHmac("sha256", secret)
    .update(`${scope}:${email.trim().toLowerCase()}`)
    .digest("hex");
}

/** Only valid IPs go to the `inet` column (the rest becomes NULL). */
function validIp(ip: string | undefined): string | null {
  return ip && isIP(ip) ? ip : null;
}

/** Failures from the same network: the IP itself, or its /64 for IPv6 (one home or phone). */
function sameNetwork(address: string | null) {
  if (!address) return isNull(loginFailures.ip);
  if (isIP(address) === 4) return eq(loginFailures.ip, address);
  return sql`${loginFailures.ip} <<= network(set_masklen(${address}::inet, 64))`;
}

/** Lockout duration after `failures` failures: 0, or 15 min doubling every 5. */
export function lockDurationMs(failures: number): number {
  const level = Math.floor(failures / LOCKOUT.perAccount);
  if (level < 1) return 0;
  return Math.min(LOCKOUT.baseLockMs * 2 ** (level - 1), LOCKOUT.maxLockMs);
}

export async function checkLockout(
  db: Database,
  {
    scope,
    hash,
    ip,
    now = new Date(),
  }: { scope: AuthScope; hash: string; ip?: string; now?: Date },
): Promise<LockoutStatus> {
  const since = new Date(now.getTime() - LOCKOUT.accountWindowMs);
  const [account] = await db
    .select({
      count: sql<number>`count(*)::int`,
      last: sql<Date | null>`max(${loginFailures.createdAt})`,
    })
    .from(loginFailures)
    .where(
      and(
        eq(loginFailures.scope, scope),
        eq(loginFailures.emailHash, hash),
        sameNetwork(validIp(ip)),
        gte(loginFailures.createdAt, since),
      ),
    );
  const duration = lockDurationMs(account?.count ?? 0);
  if (duration > 0 && account?.last) {
    const until = new Date(account.last).getTime() + duration;
    if (until > now.getTime()) {
      return { locked: true, retryAfterSeconds: Math.ceil((until - now.getTime()) / 1000) };
    }
  }

  const address = validIp(ip);
  if (address) {
    const ipSince = new Date(now.getTime() - LOCKOUT.ipWindowMs);
    const [byIp] = await db
      .select({
        count: sql<number>`count(*)::int`,
        first: sql<Date | null>`min(${loginFailures.createdAt})`,
      })
      .from(loginFailures)
      .where(
        and(
          eq(loginFailures.scope, scope),
          eq(loginFailures.ip, address),
          gte(loginFailures.createdAt, ipSince),
        ),
      );
    if ((byIp?.count ?? 0) >= LOCKOUT.perIp && byIp?.first) {
      const until = new Date(byIp.first).getTime() + LOCKOUT.ipWindowMs;
      return {
        locked: true,
        retryAfterSeconds: Math.max(1, Math.ceil((until - now.getTime()) / 1000)),
      };
    }
  }
  return { locked: false, retryAfterSeconds: 0 };
}

export async function recordFailure(
  db: Database,
  {
    scope,
    hash,
    ip,
    now = new Date(),
  }: { scope: AuthScope; hash: string; ip?: string; now?: Date },
): Promise<void> {
  await db
    .insert(loginFailures)
    .values({ scope, emailHash: hash, ip: validIp(ip), createdAt: now });
}

/** A correct sign-in or a password reset clears the account's failures (the IP's keep counting). */
export async function clearFailures(
  db: Database,
  { scope, hash }: { scope: AuthScope; hash: string },
): Promise<void> {
  await db
    .delete(loginFailures)
    .where(and(eq(loginFailures.scope, scope), eq(loginFailures.emailHash, hash)));
}

/** After a password reset: whoever proved they own the e-mail starts with a clean slate. */
export async function clearFailuresAfterReset(
  db: Database,
  { secret, scope, email }: { secret: string; scope: AuthScope; email: string },
): Promise<void> {
  await clearFailures(db, { scope, hash: emailHash(secret, scope, email) });
}

/** Retention: failures older than 30 days are removed (daily job). */
export async function purgeOldFailures(db: Database, now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const deleted = await db
    .delete(loginFailures)
    .where(lt(loginFailures.createdAt, cutoff))
    .returning({ id: loginFailures.id });
  return deleted.length;
}
