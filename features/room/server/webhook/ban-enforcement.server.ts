import type { DbExecutor } from "@/server/db/index.server";
import type { LiveKitGateway } from "@/features/room/server/livekit-gateway.server";
import { bannedFromThisCall } from "@/features/room/server/room-bans.server";
import {
  memberInSession,
  roomCodeForMedia,
  sessionByMediaName,
} from "@/features/room/server/session-store.server";
import type { WebhookPayload } from "./payload";

/**
 * With host controls the relay is the door. A token kept from before still reaches LiveKit
 * if its signaling is exposed, so the join is checked against the session as well: closed,
 * the person excluded, or locked with them never admitted, and they do not belong there.
 */
async function refusedBySession(db: DbExecutor, mediaRoom: string, identity: string) {
  const found = await sessionByMediaName(db, mediaRoom);
  if (!found) return false;
  const { session } = found;
  if (session.status === "closed") return true;
  const member = await memberInSession(db, session.id, identity);
  if (member?.excludedAt) return true;
  return session.admissionLocked && !member?.admittedAt;
}

/**
 * A ban only refuses new tokens, but the LiveKit token already issued stays valid for its
 * whole TTL: someone banned could rejoin with it. Every join is checked against the bans of
 * that call and, with host controls, against its session; anyone refused is disconnected
 * again. Returns whether they were removed.
 */
export async function removeBannedJoin(
  db: DbExecutor,
  gateway: Pick<LiveKitGateway, "removeParticipant">,
  payload: WebhookPayload,
): Promise<boolean> {
  if (payload.event !== "participant_joined") return false;
  const mediaRoom = payload.room?.name;
  const livekitRoomSid = payload.room?.sid;
  const identity = payload.participant?.identity;
  if (!mediaRoom || !livekitRoomSid || !identity) return false;
  // Bans are saved by the public code; with host controls the call has a media name.
  const roomCode = await roomCodeForMedia(db, mediaRoom);
  const banned =
    (await bannedFromThisCall(db, { roomCode, identity, livekitRoomSid })) ||
    (await refusedBySession(db, mediaRoom, identity));
  if (!banned) return false;
  return gateway.removeParticipant(mediaRoom, identity);
}
