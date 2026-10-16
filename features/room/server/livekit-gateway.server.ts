import { AccessToken, RoomConfiguration, ServerError, TrackSource } from "livekit-server-sdk";
import type { TokenGrant } from "@/features/room/domain/issue-token";
import { isGuestIdentity } from "@/features/room/domain/participant-label";
import { ROLE_ATTRIBUTE, type RoomRole } from "@/features/room/domain/room-role";
import { getEnv } from "@/server/env.server";
import { roomService } from "./room-service.server";

const TOKEN_TTL = "10m";

/** Microphone, camera and screen: nothing else can be published with the token. */
const PUBLISH_SOURCES = [
  TrackSource.MICROPHONE,
  TrackSource.CAMERA,
  TrackSource.SCREEN_SHARE,
  TrackSource.SCREEN_SHARE_AUDIO,
];

/** What token issuing needs from LiveKit (an object literal in tests). */
export interface LiveKitGateway {
  countParticipants: (room: string, excludingIdentity: string) => Promise<number>;
  /** Is someone with an account connected? Read from LiveKit, so it has no webhook delay. */
  hostPresent: (room: string) => Promise<boolean>;
  signToken: (grant: TokenGrant) => Promise<string>;
  /** sid of the call happening now in the room; `undefined` when the room is closed. */
  roomSid: (room: string) => Promise<string | undefined>;
  /** Disconnects someone; `false` when that identity is not in the room. */
  removeParticipant: (room: string, identity: string) => Promise<boolean>;
  /** Shows a new role in the call; `false` when that identity is not in the room. */
  updateRole: (room: string, identity: string, role: RoomRole) => Promise<boolean>;
}

/** Who is connected to the room right now, read from LiveKit (no webhook delay). */
export async function identitiesIn(room: string): Promise<string[]> {
  try {
    const participants = await roomService().listParticipants(room);
    return participants.map((participant) => participant.identity);
  } catch (error) {
    // Room does not exist yet: nobody inside.
    if (error instanceof ServerError && error.status === 404) return [];
    throw error;
  }
}

export const liveKitGateway: LiveKitGateway = {
  async countParticipants(room, excludingIdentity) {
    return (await identitiesIn(room)).filter((identity) => identity !== excludingIdentity).length;
  },

  async hostPresent(room) {
    return (await identitiesIn(room)).some((identity) => !isGuestIdentity(identity));
  },

  async signToken({ identity, name, room, role = "participant", canShare = true }) {
    const env = getEnv();
    // Identity = account: the same person in two tabs takes a single spot in the room
    // (LiveKit disconnects the previous connection) and events map to the right account.
    const token = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
      identity,
      name,
      ttl: TOKEN_TTL,
      // Signed by the server: the browser cannot give itself another role.
      attributes: { [ROLE_ATTRIBUTE]: role },
    });
    token.addGrant({
      room,
      roomJoin: true,
      canPublish: true,
      // Without screen sharing the camera stays: only the screen sources go.
      canPublishSources: canShare ? PUBLISH_SOURCES : [TrackSource.MICROPHONE, TrackSource.CAMERA],
      canSubscribe: true,
      // Chat, reactions and pointer use the data channel.
      canPublishData: true,
      // No canUpdateOwnMetadata: it would allow changing one's own name in the room.
      // "Raise hand" goes through the server (/api/sala/mao).
    });
    // Safety net: LiveKit itself refuses joins above the limit.
    token.roomConfig = new RoomConfiguration({ maxParticipants: env.MAX_PARTICIPANTS });
    return token.toJwt();
  },

  async roomSid(room) {
    const [current] = await roomService().listRooms([room]);
    return current?.sid || undefined;
  },

  async removeParticipant(room, identity) {
    try {
      await roomService().removeParticipant(room, identity);
      return true;
    } catch (error) {
      if (error instanceof ServerError && error.status === 404) return false;
      throw error;
    }
  },

  async updateRole(room, identity, role) {
    try {
      await roomService().updateParticipant(room, identity, {
        attributes: { [ROLE_ATTRIBUTE]: role },
      });
      return true;
    } catch (error) {
      if (error instanceof ServerError && error.status === 404) return false;
      throw error;
    }
  },
};
