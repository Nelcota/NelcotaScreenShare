import { useDataChannel, useLocalParticipant } from "@livekit/components-react";
import { Track } from "livekit-client";
import { playPeerSound } from "@/features/room/audio/call-sounds";
import { decodeMessage, screenWatchSchema, TOPICS } from "@/features/room/domain/data-channel";

/**
 * While you share a screen, a short sound when someone starts or stops watching it (#413).
 * Only a notice about your current screen counts. "Sem som" does not silence it: it only
 * stops the voices.
 */
export function useViewerSounds() {
  const { localParticipant } = useLocalParticipant();

  useDataChannel(TOPICS.screenWatch, (message) => {
    // Only a person in the call watches: a packet with no sender is not a viewer.
    if (message.from === undefined) return;
    // Read when the notice arrives: publishing a screen does not redraw the call.
    const ownScreen = localParticipant.getTrackPublication(Track.Source.ScreenShare)?.trackSid;
    if (!ownScreen) return;
    const notice = decodeMessage(message.payload, screenWatchSchema);
    if (notice?.trackSid !== ownScreen) return;
    void playPeerSound(notice.watching ? "viewer-joined" : "viewer-left");
  });
}
