import { useDataChannel, useLocalParticipant } from "@livekit/components-react";
import { Track } from "livekit-client";
import { playPeerSound } from "@/features/room/audio/call-sounds";
import { decodeMessage, screenWatchSchema, TOPICS } from "@/features/room/domain/data-channel";
import { useDeafen } from "@/features/room/ui/dock/Deafen";

/**
 * While you share a screen, a short sound when someone starts or stops watching it (#413).
 * Only a notice about your current screen counts; not hearing the room silences it too.
 */
export function useViewerSounds() {
  const { localParticipant } = useLocalParticipant();
  const { deafened } = useDeafen();
  const ownScreen = localParticipant.getTrackPublication(Track.Source.ScreenShare)?.trackSid;

  useDataChannel(TOPICS.screenWatch, (message) => {
    if (deafened || !ownScreen) return;
    const notice = decodeMessage(message.payload, screenWatchSchema);
    if (notice?.trackSid !== ownScreen) return;
    void playPeerSound(notice.watching ? "viewer-joined" : "viewer-left");
  });
}
