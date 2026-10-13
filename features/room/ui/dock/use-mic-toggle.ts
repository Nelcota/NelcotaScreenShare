import { useLocalParticipant } from "@livekit/components-react";
import { useState } from "react";
import { callToast as toast } from "@/features/room/client/call-notices";
import { roomMicErrorMessage } from "@/features/room/client/microphone-errors";
import { MIC_ERROR_TOAST } from "@/features/room/client/toast-ids";
import { playCallSound } from "@/features/room/audio/call-sounds";
import { useDeafen } from "./Deafen";

/** Turns the microphone on or off, from the dock or from the minimized call. */
export function useMicToggle() {
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const [busy, setBusy] = useState(false);
  const deafen = useDeafen();

  async function toggle() {
    setBusy(true);
    try {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
      void playCallSound(isMicrophoneEnabled ? "mic-off" : "mic-on");
      // Talking again means hearing again: nobody speaks to a room they cannot hear.
      if (!isMicrophoneEnabled) deafen.hearAgain();
    } catch (error) {
      toast.error(roomMicErrorMessage(error), { id: MIC_ERROR_TOAST });
    } finally {
      setBusy(false);
    }
  }

  return { enabled: isMicrophoneEnabled, busy, toggle };
}
