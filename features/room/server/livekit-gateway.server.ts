import { AccessToken, RoomConfiguration, ServerError, TrackSource } from "livekit-server-sdk";
import type { TokenGrant } from "@/features/room/domain/issue-token";
import { isGuestIdentity } from "@/features/room/domain/participant-label";
import { getEnv } from "@/server/env.server";
import { roomService } from "./room-service.server";

const TOKEN_TTL = "10m";

/** The app only uses microphone and screen: the token does not allow publishing a camera. */
const PUBLISH_SOURCES = [
  TrackSource.MICROPHONE,
  TrackSource.SCREEN_SHARE,
  TrackSource.SCREEN_SHARE_AUDIO,
];

/** What token issuing needs from LiveKit (an object literal in tests). */
export interface LiveKitGateway {
  countParticipants: (room: string, excludingIdentity: string) => Promise<number>;
  /** Is someone with an account connected? Read from LiveKit, so it has no webhook delay. */
  hostPresent: (room: string) => Promise<boolean>;
  signToken: (grant: TokenGrant) => Promise<string>;
}

async function identitiesIn(room: string): Promise<string[]> {
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

  async signToken({ identity, name, room, canShare = true }) {
    const env = getEnv();
    // Identity = account: the same person in two tabs takes a single spot in the room
    // (LiveKit disconnects the previous connection) and events map to the right account.
    const token = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
      identity,
      name,
      ttl: TOKEN_TTL,
    });
    token.addGrant({
      room,
      roomJoin: true,
      canPublish: true,
      canPublishSources: canShare ? PUBLISH_SOURCES : [TrackSource.MICROPHONE],
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
};
