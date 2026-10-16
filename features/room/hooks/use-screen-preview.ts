import { useDataChannel, useRoomContext, type TrackReference } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import { useEffect, useEffectEvent, useState } from "react";
import { screenFrameSource } from "@/features/room/client/screen-preview-frame";
import {
  createReceiveThrottle,
  decodeMessage,
  encodeMessage,
  SCREEN_PREVIEW_MAX_LENGTH,
  screenPreviewSchema,
  TOPICS,
} from "@/features/room/domain/data-channel";
import { logBrowserWarning } from "@/lib/telemetry.client";

/** One frame every few seconds is enough for a hint of the screen. */
const SEND_EVERY_MS = 5000;
/** The first frame goes out soon after sharing starts, once the video has a picture. */
const FIRST_FRAME_MS = 1000;

/**
 * While this person shares a screen, a tiny blurred frame of it goes to the room every
 * 5 s over the data channel (a few KB). It is never sent to the server's storage, logs or
 * database: LiveKit relays it to the browsers in the room and forgets it.
 *
 * `ownScreen` comes from useTracks: reading the publication off the participant object
 * would stay as it was (the React Compiler keeps it while the object is the same).
 */
export function useBroadcastScreenPreview(ownScreen: TrackReference | undefined) {
  const room = useRoomContext();
  const track = ownScreen?.publication.track?.mediaStreamTrack;
  const trackSid = ownScreen?.publication.trackSid;
  const { send } = useDataChannel(TOPICS.screenPreview);
  const sendFrame = useEffectEvent((payload: Uint8Array) => send(payload, { reliable: true }));

  useEffect(() => {
    if (!track || !trackSid) return;
    const source = screenFrameSource(track);
    let warned = false;
    const share = async () => {
      // Nobody else in the room: nothing to send.
      if (room.remoteParticipants.size === 0) return;
      const image = source.grab();
      if (!image || image.length > SCREEN_PREVIEW_MAX_LENGTH) return;
      try {
        await sendFrame(encodeMessage({ trackSid, image }));
      } catch (error) {
        if (!warned) logBrowserWarning("Could not send the screen preview", error);
        warned = true;
      }
    };
    const first = setTimeout(() => void share(), FIRST_FRAME_MS);
    const every = setInterval(() => void share(), SEND_EVERY_MS);
    // Someone who just arrived sees it soon, not after the next round.
    const arrived = () => void share();
    room.on(RoomEvent.ParticipantConnected, arrived);
    return () => {
      clearTimeout(first);
      clearInterval(every);
      room.off(RoomEvent.ParticipantConnected, arrived);
      source.stop();
    };
  }, [room, track, trackSid]);
}

/**
 * The latest frame of this person's screen, kept only in this browser's memory and gone
 * when the tile goes (sharing stopped, or "Assistir" took the screen to the stage).
 * `undefined` until the first one arrives.
 */
export function useScreenPreview(sharerIdentity: string, trackSid: string): string | undefined {
  const [preview, setPreview] = useState<{ trackSid: string; image: string }>();
  const [accept] = useState(() => createReceiveThrottle(SEND_EVERY_MS / 2));

  useDataChannel(TOPICS.screenPreview, (message) => {
    // Only the person sharing this screen may send its frames.
    const sender = message.from?.identity;
    if (sender !== sharerIdentity || !accept(sender)) return;
    const frame = decodeMessage(message.payload, screenPreviewSchema);
    if (!frame || frame.trackSid !== trackSid) return;
    setPreview(frame);
  });

  if (preview?.trackSid !== trackSid) return undefined;
  return preview.image;
}
