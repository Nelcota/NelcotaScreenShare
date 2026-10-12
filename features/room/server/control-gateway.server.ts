import { ServerError, TrackSource, type ParticipantInfo } from "livekit-server-sdk";
import { roomService } from "./room-service.server";
import { mayShareScreen } from "@/features/room/domain/host-controls";
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
  async sync(session: ControlSession) {
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
