import { ServerError, TrackSource, type ParticipantInfo } from "livekit-server-sdk";
import { roomService } from "./room-service.server";
import { mayShareScreen } from "@/features/room/domain/host-controls";
import { ROLE_ATTRIBUTE, type RoomRole } from "@/features/room/domain/room-role";
import type { ControlSession } from "./session-store.server";

/** Media administration stays behind the existing server gateway. */
export const controlGateway = {
  async participants(mediaRoomName: string): Promise<ParticipantInfo[]> {
    try {
      return await roomService().listParticipants(mediaRoomName);
    } catch (error) {
      if (error instanceof ServerError && error.status === 404) return [];
      throw error;
    }
  },
  async remove(mediaRoomName: string, identity: string) {
    try {
      await roomService().removeParticipant(mediaRoomName, identity);
    } catch (error) {
      if (!(error instanceof ServerError && error.status === 404)) throw error;
    }
  },
  async close(mediaRoomName: string) {
    try {
      await roomService().deleteRoom(mediaRoomName);
    } catch (error) {
      if (!(error instanceof ServerError && error.status === 404)) throw error;
    }
  },
  /** Applies the session's current permissions and the room's saved roles to everyone in it. */
  async sync(session: ControlSession, roles: ReadonlyMap<string, RoomRole> = new Map()) {
    const participants = await this.participants(session.mediaRoomName);
    for (const participant of participants) {
      const permitted = mayShareScreen(
        participant.identity,
        session.hostUserId,
        session.sharePolicy,
        session.allowedSharers,
      );
      const sources = permitted
        ? [TrackSource.MICROPHONE, TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO]
        : [TrackSource.MICROPHONE];
      // LiveKit SetPermission removes already published tracks of revoked sources.
      try {
        await roomService().updateParticipant(session.mediaRoomName, participant.identity, {
          attributes: { [ROLE_ATTRIBUTE]: roles.get(participant.identity) ?? "participant" },
          permission: {
            canPublish: true,
            canPublishSources: sources,
            canPublishData: true,
            canSubscribe: true,
          },
        });
      } catch (error) {
        if (!(error instanceof ServerError && error.status === 404)) throw error;
      }
    }
  },
};
