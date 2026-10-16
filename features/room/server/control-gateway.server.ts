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
    // In parallel: this runs under the room's lock, so a slow LiveKit costs one request's
    // wait instead of one per person in the call.
    const updates = participants.map(async (participant) => {
      const permitted = mayShareScreen(
        participant.identity,
        session.hostUserId,
        session.sharePolicy,
        session.allowedSharers,
      );
      // The camera stays with the microphone: the policy only covers screen sharing.
      const sources = permitted
        ? [
            TrackSource.MICROPHONE,
            TrackSource.CAMERA,
            TrackSource.SCREEN_SHARE,
            TrackSource.SCREEN_SHARE_AUDIO,
          ]
        : [TrackSource.MICROPHONE, TrackSource.CAMERA];
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
    });
    // Every update finishes (or fails) before the command reports back, as in the old loop.
    const failure = (await Promise.allSettled(updates)).find(
      (result) => result.status === "rejected",
    );
    if (failure) throw failure.reason;
  },
};
