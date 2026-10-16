import { and, eq, isNotNull, like } from "drizzle-orm";
import type { DbExecutor } from "@/server/db/index.server";
import { roomBans } from "@/server/db/schema";
import { roomSessionMembers } from "@/server/db/schema/room-control";
import { GUEST_IDENTITY_PREFIX } from "@/features/room/domain/participant-label";
import { readGuestId } from "./guest-session.server";
import { mediaRoomIn, memberInSession, openControlSession } from "./session-store.server";
import { getEnv } from "@/server/env.server";
import type { LiveKitGateway } from "./livekit-gateway.server";

interface CallIdentity {
  roomCode: string;
  identity: string;
}

/**
 * Banned from the call happening now. Most people were never banned from the room, so
 * the database is read first and LiveKit is only asked for the current call when needed.
 */
export async function bannedFromCall(
  db: DbExecutor,
  gateway: Pick<LiveKitGateway, "roomSid">,
  { roomCode, identity }: CallIdentity,
): Promise<boolean> {
  if (getEnv().ROOM_HOST_CONTROLS_ENABLED) return excludedFromOpenSession(db, roomCode, identity);
  const bans = await db
    .select({ sid: roomBans.livekitRoomSid })
    .from(roomBans)
    .where(and(eq(roomBans.roomCode, roomCode), eq(roomBans.identity, identity)));
  if (bans.length === 0) return false;
  const currentSid = await gateway.roomSid(await mediaRoomIn(db, roomCode));
  if (currentSid === undefined) return false;
  return bans.some((ban) => ban.sid === currentSid);
}

/** Bans from this call only; banning the same person twice keeps the first record. */
export async function banFromCall(
  db: DbExecutor,
  ban: CallIdentity & {
    livekitRoomSid: string;
    bannedBy: { userId: string } | { adminId: string };
  },
): Promise<void> {
  const { bannedBy, ...call } = ban;
  await db
    .insert(roomBans)
    .values({
      ...call,
      bannedByUserId: "userId" in bannedBy ? bannedBy.userId : null,
      bannedByAdminId: "adminId" in bannedBy ? bannedBy.adminId : null,
    })
    .onConflictDoNothing();
}

/** Banned from exactly this call: the webhook already knows the call's sid. */
export async function bannedFromThisCall(
  db: DbExecutor,
  { roomCode, identity, livekitRoomSid }: CallIdentity & { livekitRoomSid: string },
): Promise<boolean> {
  const [ban] = await db
    .select({ id: roomBans.id })
    .from(roomBans)
    .where(
      and(
        eq(roomBans.roomCode, roomCode),
        eq(roomBans.identity, identity),
        eq(roomBans.livekitRoomSid, livekitRoomSid),
      ),
    )
    .limit(1);
  return ban !== undefined;
}

/**
 * Is whoever opens the room page banned from the call happening now? The account, or the
 * guest from the signed cookie; someone without either has no identity to ban yet.
 */
export async function visitorBannedFromCall(
  db: DbExecutor,
  gateway: Pick<LiveKitGateway, "roomSid">,
  { roomCode, userId, request }: { roomCode: string; userId: string | undefined; request: Request },
): Promise<boolean> {
  const identity = userId ?? (await guestIdentity(request));
  if (identity === undefined) return false;
  return bannedFromCall(db, gateway, { roomCode, identity });
}

async function guestIdentity(request: Request): Promise<string | undefined> {
  const guestId = await readGuestId(request);
  if (guestId === undefined) return undefined;
  return `${GUEST_IDENTITY_PREFIX}${guestId}`;
}

/**
 * Was any guest banned from the call happening now? A banned guest without the cookie
 * would come back as a new one: new guests then ask the host first.
 */
export async function guestBannedFromCall(
  db: DbExecutor,
  gateway: Pick<LiveKitGateway, "roomSid">,
  roomCode: string,
): Promise<boolean> {
  const guests = like(roomBans.identity, `${GUEST_IDENTITY_PREFIX}%`);
  if (getEnv().ROOM_HOST_CONTROLS_ENABLED) {
    const session = await openControlSession(db, roomCode);
    if (!session) return false;
    const [excluded] = await db
      .select({ identity: roomSessionMembers.identity })
      .from(roomSessionMembers)
      .where(
        and(
          eq(roomSessionMembers.sessionId, session.id),
          isNotNull(roomSessionMembers.excludedAt),
          like(roomSessionMembers.identity, `${GUEST_IDENTITY_PREFIX}%`),
        ),
      )
      .limit(1);
    return excluded !== undefined;
  }
  const bans = await db
    .select({ sid: roomBans.livekitRoomSid })
    .from(roomBans)
    .where(and(eq(roomBans.roomCode, roomCode), guests));
  if (bans.length === 0) return false;
  const currentSid = await gateway.roomSid(await mediaRoomIn(db, roomCode));
  return currentSid !== undefined && bans.some((ban) => ban.sid === currentSid);
}

/** With host controls, a ban is the exclusion from the call open now (ADR 0007). */
async function excludedFromOpenSession(db: DbExecutor, roomCode: string, identity: string) {
  const session = await openControlSession(db, roomCode);
  if (!session) return false;
  const member = await memberInSession(db, session.id, identity);
  return Boolean(member?.excludedAt);
}
