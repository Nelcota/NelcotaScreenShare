import { createHash, createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import { isFriendLinkToken } from "@/features/friends/domain/friend-link";
import type { DbExecutor } from "@/server/db/index.server";
import { friendLinks } from "@/server/db/schema";
import { getEnv } from "@/server/env.server";

/** The token comes from the server secret, the account and the link version. */
function linkToken(userId: string, version: number): string {
  return createHmac("sha256", getEnv().AUTH_SECRET)
    .update(`friend-link:${userId}:${version}`)
    .digest("base64url");
}

function hashLinkToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * The account's friend link, created on first use. If the server secret changed, the
 * stored hash is brought in line, so the link shown always works (older copies stop).
 */
export async function friendLinkToken(db: DbExecutor, userId: string): Promise<string> {
  await db
    .insert(friendLinks)
    .values({ userId, version: 1, tokenHash: hashLinkToken(linkToken(userId, 1)) })
    .onConflictDoNothing();
  const [row] = await db
    .select({ version: friendLinks.version, tokenHash: friendLinks.tokenHash })
    .from(friendLinks)
    .where(eq(friendLinks.userId, userId));
  if (!row) throw new Error("friend link was not created");
  const token = linkToken(userId, row.version);
  const tokenHash = hashLinkToken(token);
  if (tokenHash === row.tokenHash) return token;
  await db.update(friendLinks).set({ tokenHash }).where(eq(friendLinks.userId, userId));
  return token;
}

/** A new link; the previous one stops working. Run inside a transaction. */
export async function rotateFriendLink(db: DbExecutor, userId: string): Promise<string> {
  await friendLinkToken(db, userId);
  const [row] = await db
    .select({ version: friendLinks.version })
    .from(friendLinks)
    .where(eq(friendLinks.userId, userId))
    .for("update");
  if (!row) throw new Error("friend link was not created");
  const version = row.version + 1;
  const token = linkToken(userId, version);
  await db
    .update(friendLinks)
    .set({ version, tokenHash: hashLinkToken(token) })
    .where(eq(friendLinks.userId, userId));
  return token;
}

/** Who the link belongs to, or null for an unknown or old link. */
export async function ownerOfFriendLink(db: DbExecutor, token: string): Promise<string | null> {
  if (!isFriendLinkToken(token)) return null;
  const [row] = await db
    .select({ userId: friendLinks.userId })
    .from(friendLinks)
    .where(eq(friendLinks.tokenHash, hashLinkToken(token)));
  return row?.userId ?? null;
}
