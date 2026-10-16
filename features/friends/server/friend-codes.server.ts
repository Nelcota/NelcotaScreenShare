import { randomInt } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { friendCodeLength, randomFriendCode } from "@/features/friends/domain/friend-code";
import { retireFriendCode } from "@/features/friends/server/friend-code-retirement.server";
import { activeAccount } from "@/features/friends/server/friendships.server";
import type { DbExecutor } from "@/server/db/index.server";
import { friendCodes, retiredFriendCodes, users } from "@/server/db/schema";

/** Three short draws, then five-character ones, which almost never clash. */
const MAX_DRAWS = 8;

async function storedCode(db: DbExecutor, userId: string): Promise<string | null> {
  const [row] = await db
    .select({ code: friendCodes.code })
    .from(friendCodes)
    .where(eq(friendCodes.userId, userId));
  return row?.code ?? null;
}

async function isRetired(db: DbExecutor, code: string): Promise<boolean> {
  const [row] = await db
    .select({ code: retiredFriendCodes.code })
    .from(retiredFriendCodes)
    .where(eq(retiredFriendCodes.code, code));
  return row !== undefined;
}

/**
 * Saves a new random code for an account that has none, drawing again when the code is in
 * use or was used before. Codes grow to seven characters when the six-character ones clash.
 */
async function insertCode(db: DbExecutor, userId: string): Promise<string> {
  for (let draw = 0; draw < MAX_DRAWS; draw++) {
    const code = randomFriendCode(randomInt, friendCodeLength(draw));
    if (await isRetired(db, code)) continue;
    const [row] = await db
      .insert(friendCodes)
      .values({ userId, code })
      .onConflictDoNothing()
      .returning({ code: friendCodes.code });
    if (row) return row.code;
    // The account may have got its code meanwhile (another tab); otherwise the code clashed.
    const existing = await storedCode(db, userId);
    if (existing) return existing;
  }
  throw new Error("could not draw a free friend code");
}

/** The account's code, created on first use. */
export async function friendCode(db: DbExecutor, userId: string): Promise<string> {
  const existing = await storedCode(db, userId);
  if (existing) return existing;
  return insertCode(db, userId);
}

/** A new code; the previous one stops working and is never handed out again. */
export async function rotateFriendCode(db: DbExecutor, userId: string): Promise<string> {
  await retireFriendCode(db, userId);
  return insertCode(db, userId);
}

/** Who owns the code, or null for an unknown or old code. */
export async function ownerOfFriendCode(db: DbExecutor, code: string): Promise<string | null> {
  const [row] = await db
    .select({ userId: friendCodes.userId })
    .from(friendCodes)
    .where(eq(friendCodes.code, code));
  return row?.userId ?? null;
}

/** The active account with this e-mail, or null. Case does not matter. */
export async function accountByEmail(db: DbExecutor, email: string): Promise<string | null> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(sql`lower(${users.email})`, email.toLowerCase()), activeAccount()))
    .limit(1);
  return row?.id ?? null;
}
