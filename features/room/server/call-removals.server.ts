import { and, desc, eq, isNotNull } from "drizzle-orm";
import { z } from "zod";
import type { Database, DbExecutor } from "@/server/db/index.server";
import { roomBans } from "@/server/db/schema";
import { roomSessionMembers } from "@/server/db/schema/room-control";
import { getEnv } from "@/server/env.server";
import { liveKitGateway, type LiveKitGateway } from "./livekit-gateway.server";
import { lockControlRoom, mediaRoomIn, openControlSession } from "./session-store.server";

/**
 * Who was banned from the call happening now, for the admin panel. One shape for both
 * admission modes (ADR 0007): the session exclusion with host controls on, `room_bans` for
 * the LiveKit call with them off.
 */
export interface CallRemoval {
  identity: string;
  /** The account, or `null` for a guest. */
  userId: string | null;
  removedAt: Date;
  byUserId: string | null;
  byAdminId: string | null;
}

export type ReadmitResult = { ok: true } | { ok: false; reason: "not_removed" | "no_call" };

type SidGateway = Pick<LiveKitGateway, "roomSid">;

const accountId = z.uuid();

function userIdOf(identity: string): string | null {
  return accountId.safeParse(identity).success ? identity : null;
}

/** Removals from the call open now, newest first; none when no call is open. */
export async function listCallRemovals(
  db: DbExecutor,
  roomCode: string,
  gateway: SidGateway = liveKitGateway,
): Promise<CallRemoval[]> {
  if (getEnv().ROOM_HOST_CONTROLS_ENABLED) return sessionRemovals(db, roomCode);
  return bannedFromLiveKitCall(db, roomCode, gateway);
}

/**
 * "Tirar ban" from the panel: the person may join this call again. The caller audits it.
 * With host controls on the exclusion is cleared under the room's control lock; nothing
 * needs to reach LiveKit, since the person is already out and comes back with a new token.
 */
export async function readmitToSession(
  db: Database,
  { roomCode, identity }: { roomCode: string; identity: string },
  gateway: SidGateway = liveKitGateway,
): Promise<ReadmitResult> {
  if (getEnv().ROOM_HOST_CONTROLS_ENABLED) return readmitToOpenSession(db, roomCode, identity);
  return liftLiveKitCallBan(db, roomCode, identity, gateway);
}

async function sessionRemovals(db: DbExecutor, roomCode: string): Promise<CallRemoval[]> {
  const session = await openControlSession(db, roomCode);
  if (!session) return [];
  const rows = await db
    .select({
      identity: roomSessionMembers.identity,
      userId: roomSessionMembers.userId,
      removedAt: roomSessionMembers.excludedAt,
      byUserId: roomSessionMembers.excludedByUserId,
      byAdminId: roomSessionMembers.excludedByAdminId,
    })
    .from(roomSessionMembers)
    .where(
      and(eq(roomSessionMembers.sessionId, session.id), isNotNull(roomSessionMembers.excludedAt)),
    )
    .orderBy(desc(roomSessionMembers.excludedAt));
  return rows.flatMap((row) => (row.removedAt ? [{ ...row, removedAt: row.removedAt }] : []));
}

async function bannedFromLiveKitCall(
  db: DbExecutor,
  roomCode: string,
  gateway: SidGateway,
): Promise<CallRemoval[]> {
  const sid = await gateway.roomSid(await mediaRoomIn(db, roomCode));
  if (sid === undefined) return [];
  const rows = await db
    .select()
    .from(roomBans)
    .where(and(eq(roomBans.roomCode, roomCode), eq(roomBans.livekitRoomSid, sid)))
    .orderBy(desc(roomBans.createdAt));
  return rows.map((ban) => ({
    identity: ban.identity,
    userId: userIdOf(ban.identity),
    removedAt: ban.createdAt,
    byUserId: ban.bannedByUserId,
    byAdminId: ban.bannedByAdminId,
  }));
}

async function readmitToOpenSession(
  db: Database,
  roomCode: string,
  identity: string,
): Promise<ReadmitResult> {
  return db.transaction(async (tx) => {
    await lockControlRoom(tx, roomCode);
    const session = await openControlSession(tx, roomCode);
    if (!session) return { ok: false, reason: "no_call" } as const;
    const [readmitted] = await tx
      .update(roomSessionMembers)
      .set({ excludedAt: null, excludedByUserId: null, excludedByAdminId: null })
      .where(
        and(
          eq(roomSessionMembers.sessionId, session.id),
          eq(roomSessionMembers.identity, identity),
          isNotNull(roomSessionMembers.excludedAt),
        ),
      )
      .returning({ identity: roomSessionMembers.identity });
    if (!readmitted) return { ok: false, reason: "not_removed" } as const;
    return { ok: true } as const;
  });
}

async function liftLiveKitCallBan(
  db: DbExecutor,
  roomCode: string,
  identity: string,
  gateway: SidGateway,
): Promise<ReadmitResult> {
  const sid = await gateway.roomSid(await mediaRoomIn(db, roomCode));
  if (sid === undefined) return { ok: false, reason: "no_call" };
  const lifted = await db
    .delete(roomBans)
    .where(
      and(
        eq(roomBans.roomCode, roomCode),
        eq(roomBans.identity, identity),
        eq(roomBans.livekitRoomSid, sid),
      ),
    )
    .returning({ id: roomBans.id });
  if (lifted.length === 0) return { ok: false, reason: "not_removed" };
  return { ok: true };
}
