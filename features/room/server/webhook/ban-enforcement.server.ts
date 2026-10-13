import type { DbExecutor } from "@/server/db/index.server";
import type { LiveKitGateway } from "@/features/room/server/livekit-gateway.server";
import { bannedFromThisCall } from "@/features/room/server/room-bans.server";
import { roomCodeForMedia } from "@/features/room/server/session-store.server";
import type { WebhookPayload } from "./payload";

/**
 * A ban only refuses new tokens, but the LiveKit token already issued stays valid for its
 * whole TTL: someone banned could rejoin with it. Every join is checked against the bans of
 * that call, and a banned person is disconnected again. Returns whether they were removed.
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
  if (!(await bannedFromThisCall(db, { roomCode, identity, livekitRoomSid }))) return false;
  return gateway.removeParticipant(mediaRoom, identity);
}
