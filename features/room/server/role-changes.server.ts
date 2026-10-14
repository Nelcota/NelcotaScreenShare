import { and, eq, isNull } from "drizzle-orm";
import {
  roleChangeRefusal,
  type RoleChange,
  type RoleChangeRefusal,
} from "@/features/room/domain/role-change";
import type { RoomRole } from "@/features/room/domain/room-role";
import type { Database, DbExecutor } from "@/server/db/index.server";
import { roomRoles, users } from "@/server/db/schema";
import { roomDefinitions } from "@/server/db/schema/room-control";
import { roomRoleOf } from "./room-roles.server";

interface RoleChangeInput {
  roomCode: string;
  actorUserId: string;
  targetUserId: string;
  change: RoleChange;
}

/** Each account whose role changed, so the call can show it right away. */
export interface ChangedRole {
  userId: string;
  role: RoomRole;
}

export type RoleChangeResult =
  | { ok: true; changed: ChangedRole[] }
  | { ok: false; error: RoleChangeRefusal | "no_account" };

/** The owner's name, for "Sala de Ana"; `null` when the room has no owner. */
export async function roomOwnerName(db: DbExecutor, roomCode: string): Promise<string | null> {
  const [owner] = await db
    .select({ name: users.name })
    .from(roomRoles)
    .innerJoin(users, eq(users.id, roomRoles.userId))
    .where(
      and(eq(roomRoles.roomCode, roomCode), eq(roomRoles.role, "owner"), isNull(users.deletedAt)),
    );
  return owner?.name ?? null;
}

/** An account that can take a role: not deleted and not blocked by the admin panel. */
async function activeAccount(db: DbExecutor, userId: string): Promise<boolean> {
  const [account] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt), isNull(users.blockedAt)));
  return account !== undefined;
}

/**
 * Makes an account a moderator, takes that back, or hands the room over. One transaction,
 * with the owner's row locked: two changes at once cannot leave two owners or none.
 */
export async function applyRoleChange(
  db: Database,
  input: RoleChangeInput,
): Promise<RoleChangeResult> {
  return db.transaction(async (tx) => {
    const { roomCode, actorUserId, targetUserId, change } = input;
    await tx
      .select({ userId: roomRoles.userId })
      .from(roomRoles)
      .where(and(eq(roomRoles.roomCode, roomCode), eq(roomRoles.role, "owner")))
      .for("update");
    const [actor, target] = await Promise.all([
      roomRoleOf(tx, { roomCode, userId: actorUserId }),
      roomRoleOf(tx, { roomCode, userId: targetUserId }),
    ]);
    const refusal = roleChangeRefusal(change, {
      actor,
      target,
      self: actorUserId === targetUserId,
    });
    if (refusal) return { ok: false, error: refusal };
    if (!(await activeAccount(tx, targetUserId))) return { ok: false, error: "no_account" };
    return { ok: true, changed: await writeRoleChange(tx, input) };
  });
}

async function writeRoleChange(
  tx: DbExecutor,
  { roomCode, actorUserId, targetUserId, change }: RoleChangeInput,
): Promise<ChangedRole[]> {
  if (change === "promote") {
    await tx
      .insert(roomRoles)
      .values({ roomCode, userId: targetUserId, role: "moderator", grantedByUserId: actorUserId });
    return [{ userId: targetUserId, role: "moderator" }];
  }
  if (change === "demote") {
    await tx
      .delete(roomRoles)
      .where(and(eq(roomRoles.roomCode, roomCode), eq(roomRoles.userId, targetUserId)));
    return [{ userId: targetUserId, role: "participant" }];
  }
  return transferOwnership(tx, { roomCode, fromUserId: actorUserId, toUserId: targetUserId });
}

/**
 * "Transferir a sala": the target becomes the owner and the former owner stays as a
 * moderator. Also run by the host controls' transfer when the owner gives it. The caller
 * holds the owner's row or the room's control lock.
 */
export async function transferOwnership(
  tx: DbExecutor,
  { roomCode, fromUserId, toUserId }: { roomCode: string; fromUserId: string; toUserId: string },
): Promise<ChangedRole[]> {
  // The old owner steps down first: the room never has two owners, even inside the change.
  await tx
    .update(roomRoles)
    .set({ role: "moderator", grantedByUserId: toUserId })
    .where(and(eq(roomRoles.roomCode, roomCode), eq(roomRoles.userId, fromUserId)));
  await tx
    .insert(roomRoles)
    .values({ roomCode, userId: toUserId, role: "owner" })
    .onConflictDoUpdate({
      target: [roomRoles.roomCode, roomRoles.userId],
      set: { role: "owner", grantedByUserId: null },
    });
  // The registry keeps the same owner as the roles.
  await tx
    .update(roomDefinitions)
    .set({ ownerUserId: toUserId })
    .where(eq(roomDefinitions.code, roomCode));
  return [
    { userId: toUserId, role: "owner" },
    { userId: fromUserId, role: "moderator" },
  ];
}
