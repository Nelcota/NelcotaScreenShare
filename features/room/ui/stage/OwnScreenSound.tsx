import { useLocalParticipant } from "@livekit/components-react";
import { Track, type LocalTrackPublication } from "livekit-client";
import { Volume2, VolumeX } from "lucide-react";
import { useState } from "react";
import { Hint } from "@/components/Hint";
import { callToast as toast } from "@/features/room/client/call-notices";
import {
  ABSENT_SOUND_NOTICE,
  OWN_SCREEN_SOUND_LABEL,
  ownScreenSound,
} from "@/features/room/domain/screen-sound";
import { reportBrowserError } from "@/lib/telemetry.client";

async function switchSound(publication: LocalTrackPublication) {
  if (publication.isMuted) {
    await publication.unmute();
    return;
  }
  await publication.mute();
}

/**
 * On the sharer's own screen: turns its sound off and on for everyone, without stopping
 * the share. The capture stays open, so the sound comes back at once.
 */
export function OwnScreenSound() {
  const { localParticipant } = useLocalParticipant();
  const [busy, setBusy] = useState(false);
  const audio = localParticipant.getTrackPublication(Track.Source.ScreenShareAudio);
  const state = ownScreenSound(audio);
  const label = OWN_SCREEN_SOUND_LABEL[state];

  async function toggle() {
    if (audio === undefined) {
      toast.info(ABSENT_SOUND_NOTICE);
      return;
    }
    setBusy(true);
    try {
      await switchSound(audio);
    } catch (error) {
      reportBrowserError(error);
      toast.error("Não foi possível mudar o som da tela. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Hint text={label}>
      <button
        type="button"
        aria-label={label}
        disabled={busy}
        onClick={() => void toggle()}
        className="glass pointer-events-auto grid size-9 place-items-center rounded-xl text-ink-muted transition-colors hover:text-ink"
      >
        {state === "on" ? (
          <Volume2 className="size-4" aria-hidden="true" />
        ) : (
          <VolumeX className="size-4" aria-hidden="true" />
        )}
      </button>
    </Hint>
  );
}
