import { z } from "zod";
import { canModerate, type ModerationAction } from "@/features/room/domain/moderation";
import type { RoomRole } from "@/features/room/domain/room-role";
import type { Database, DbExecutor } from "@/server/db/index.server";
import { getEnv } from "@/server/env.server";
import type { LiveKitGateway } from "./livekit-gateway.server";
import { recordCallAudit } from "./call-audit.server";
import { banFromCall } from "./room-bans.server";
import { roomRoleOf } from "./room-roles.server";
import { lockControlRoom, mediaRoomIn, openControlSession } from "./session-store.server";
import { excludeFromSession } from "./session-exclusion.server";

type Gateway = Pick<LiveKitGateway, "roomSid" | "removeParticipant">;

export type ModerationResult =
  | { ok: true }
  | { ok: false; error: "forbidden" | "not_in_room"; message: string };

interface Removal {
  room: string;
  identity: string;
  action: ModerationAction;
}

const NOT_IN_ROOM: ModerationResult = {
  ok: false,
  error: "not_in_room",
  message: "Essa pessoa já saiu da sala.",
};

/** Account identities are UUIDs; guests (`convidado-…`) and anything else have no saved role. */
const accountId = z.uuid();

async function targetRole(db: DbExecutor, room: string, identity: string): Promise<RoomRole> {
  if (!accountId.safeParse(identity).success) return "participant";
  return roomRoleOf(db, { roomCode: room, userId: identity });
}

/**
 * Disconnects someone from the call; a ban is saved first, so they cannot get a new token
 * between the removal and the record. Used as is by the admin panel, which needs no role.
 * With host controls on, a ban is the session's exclusion (ADR 0007); off, it stays in
 * room_bans for the LiveKit call.
 */
export async function removeFromCall(
  db: Database,
  gateway: Gateway,
  { room, identity, action }: Removal,
  bannedBy: { userId: string } | { adminId: string },
): Promise<ModerationResult> {
  if (action === "ban" && getEnv().ROOM_HOST_CONTROLS_ENABLED) {
    const excluded = await excludeFromSession(db, { roomCode: room, identity, by: bannedBy });
    return excluded === "excluded" ? { ok: true } : NOT_IN_ROOM;
  }
  // Bans are saved by the public code; LiveKit knows the call by its media name.
  const mediaRoom = await mediaRoomIn(db, room);
  if (action === "ban") {
    const livekitRoomSid = await gateway.roomSid(mediaRoom);
    if (livekitRoomSid === undefined) return NOT_IN_ROOM;
    await banFromCall(db, { roomCode: room, identity, livekitRoomSid, bannedBy });
  }
  const removed = await gateway.removeParticipant(mediaRoom, identity);
  // A ban still counts when they had just left: they cannot come back to this call.
  if (!removed && action === "kick") return NOT_IN_ROOM;
  return { ok: true };
}

/** Removal asked from inside the call: the owner or a moderator, by the roles saved for the room. */
export async function moderateParticipant(
  db: Database,
  gateway: Gateway,
  removal: Removal & { actorUserId: string },
): Promise<ModerationResult> {
  const { actorUserId, ...target } = removal;
  return db.transaction(async (tx) => {
    await lockControlRoom(tx, target.room);
    if (!(await mayModerate(tx, removal))) {
      return {
        ok: false,
        error: "forbidden",
        message: "Só o anfitrião, o dono ou um moderador autorizado pode remover essa pessoa.",
      };
    }
    const result = await removeFromCall(tx, gateway, target, { userId: actorUserId });
    if (!result.ok) return result;
    await recordCallAudit(tx, {
      userId: actorUserId,
      action: target.action === "ban" ? "room.participant_ban" : "room.participant_kick",
      room: target.room,
      target: target.identity,
    });
    return result;
  });
}

/** The host cannot be removed by a co-host through the card's moderation endpoint either. */
async function mayModerate(db: DbExecutor, removal: Removal & { actorUserId: string }) {
  const { actorUserId, room, identity } = removal;
  if (identity === actorUserId) return false;
  const [actor, targeted] = await Promise.all([
    roomRoleOf(db, { roomCode: room, userId: actorUserId }),
    targetRole(db, room, identity),
  ]);
  if (!canModerate(actor, targeted)) return false;
  if (actor === "owner" || !getEnv().ROOM_HOST_CONTROLS_ENABLED) return true;
  return (await openControlSession(db, room))?.hostUserId !== identity;
}
