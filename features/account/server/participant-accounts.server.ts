import { cleanWorkspaceAccount, revokeWorkspaceIdentity } from "./workspace-privacy.server";
import { and, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { forgetFriendships } from "@/features/friends/server/friendships.server";
import { forgetRoomLinks } from "@/features/room/server/account-room-links.server";
import type { DbExecutor } from "@/server/db/index.server";
import { roomDefinitions, roomSessionMembers, roomSessions } from "@/server/db/schema/room-control";
import {
  roomParticipations,
  userAccounts,
  users,
  userSessions,
  userTwoFactors,
  userVerifications,
} from "@/server/db/schema";

/**
 * Operations on participant accounts, used by the panel (in bulk) and by the
 * account owner. Each one returns only the rows that actually changed, so the
 * audit log records exactly what happened.
 */

/** Blocks and kills the sessions: login and /api/token start refusing. */
export async function blockParticipants(tx: DbExecutor, ids: string[], reason: string) {
  const changed = await tx
    .update(users)
    .set({ blockedAt: sql`now()`, blockReason: reason })
    .where(and(inArray(users.id, ids), isNull(users.blockedAt), isNull(users.deletedAt)))
    .returning({ id: users.id });
  for (const row of changed) await revokeWorkspaceIdentity(tx, row.id);
  await revokeParticipantSessions(
    tx,
    changed.map((row) => row.id),
  );
  return changed.map((row) => row.id);
}

export async function unblockParticipants(tx: DbExecutor, ids: string[]) {
  const changed = await tx
    .update(users)
    .set({ blockedAt: null, blockReason: null })
    .where(and(inArray(users.id, ids), isNotNull(users.blockedAt), isNull(users.deletedAt)))
    .returning({ id: users.id });
  return changed.map((row) => row.id);
}

/** Reversible deletion (gone from lists and can no longer join); anonymizing is something else. */
export async function softDeleteParticipants(tx: DbExecutor, ids: string[]) {
  const candidates = await tx
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(and(inArray(users.id, ids), isNull(users.deletedAt)));
  for (const row of candidates) await cleanWorkspaceAccount(tx, row.id, row.email);
  const changed = await tx
    .update(users)
    .set({ deletedAt: sql`now()` })
    .where(and(inArray(users.id, ids), isNull(users.deletedAt)))
    .returning({ id: users.id });
  await revokeParticipantSessions(
    tx,
    changed.map((row) => row.id),
  );
  return changed.map((row) => row.id);
}

/** Undoes the deletion (an anonymized account does not come back). */
export async function restoreParticipants(tx: DbExecutor, ids: string[]) {
  const changed = await tx
    .update(users)
    .set({ deletedAt: null })
    .where(and(inArray(users.id, ids), isNotNull(users.deletedAt), isNull(users.anonymizedAt)))
    .returning({ id: users.id });
  return changed.map((row) => row.id);
}

export async function revokeParticipantSessions(tx: DbExecutor, ids: string[]) {
  if (ids.length === 0) return 0;
  const removed = await tx
    .delete(userSessions)
    .where(inArray(userSessions.userId, ids))
    .returning({ id: userSessions.id });
  return removed.length;
}

/**
 * Turns off 2FA for someone who lost their authenticator: the secret and backup codes
 * are deleted and every session ends, so the next sign-in asks only for the password.
 * Returns null when the account had no 2FA (nothing changed).
 */
export async function disableParticipantTwoFactor(tx: DbExecutor, id: string) {
  const [changed] = await tx
    .update(users)
    .set({ twoFactorEnabled: false })
    .where(and(eq(users.id, id), eq(users.twoFactorEnabled, true), isNull(users.deletedAt)))
    .returning({ id: users.id });
  if (!changed) return null;
  await tx.delete(userTwoFactors).where(eq(userTwoFactors.userId, id));
  return { sessions: await revokeParticipantSessions(tx, [id]) };
}

/**
 * Permanent anonymization (LGPD): e-mail and name become values without personal
 * data, credentials and sessions are removed, the name leaves the room history and the
 * account stops owning or moderating rooms.
 * The participation IP stays until the 6-month retention (access record
 * required by the Marco Civil, art. 15).
 */
export async function anonymizeParticipant(tx: DbExecutor, id: string, deleteOwnedTeams = false) {
  const [current] = await tx
    .select({ email: users.email, anonymizedAt: users.anonymizedAt })
    .from(users)
    .where(eq(users.id, id))
    .for("update");
  if (!current || current.anonymizedAt) return false;
  await cleanWorkspaceAccount(tx, id, current.email, deleteOwnedTeams);
  // The database trigger also redacts stored webhook names and serializes with new events.
  await tx
    .update(users)
    .set({
      name: "Pessoa removida",
      email: `removido+${id}@invalid.nelcota`,
      emailVerified: false,
      image: null,
      twoFactorEnabled: false,
      blockReason: null,
      anonymizedAt: sql`now()`,
      deletedAt: sql`coalesce(${users.deletedAt}, now())`,
    })
    .where(eq(users.id, id));
  await tx
    .update(roomParticipations)
    .set({ displayName: null })
    .where(eq(roomParticipations.userId, id));
  await tx.delete(userAccounts).where(eq(userAccounts.userId, id));
  await tx.delete(userTwoFactors).where(eq(userTwoFactors.userId, id));
  await tx.delete(userSessions).where(eq(userSessions.userId, id));
  await forgetFriendships(tx, id);
  await forgetRoomLinks(tx, id);
  await tx
    .update(roomDefinitions)
    .set({ ownerUserId: null, name: null })
    .where(eq(roomDefinitions.ownerUserId, id));
  await tx.update(roomSessions).set({ hostUserId: null }).where(eq(roomSessions.hostUserId, id));
  await tx
    .update(roomSessionMembers)
    .set({ userId: null, excludedAt: sql`now()` })
    .where(eq(roomSessionMembers.userId, id));
  await tx
    .update(roomSessionMembers)
    .set({ excludedByUserId: null })
    .where(eq(roomSessionMembers.excludedByUserId, id));
  // Password recovery: identifier = reset-password:<token>, value = user.id.
  await tx
    .delete(userVerifications)
    .where(or(eq(userVerifications.identifier, current.email), eq(userVerifications.value, id)));
  return true;
}
