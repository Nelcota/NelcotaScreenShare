import { useLocalParticipant, useRoomContext } from "@livekit/components-react";
import { LocalAudioTrack, RoomEvent, TrackEvent, type Room } from "livekit-client";
import { useEffect } from "react";
import { toast } from "sonner";
import { MIC_ERROR_TOAST } from "@/features/room/client/toast-ids";
import {
  defaultMovedAway,
  replacementMicrophone,
} from "@/features/room/domain/microphone-recovery";
import { logBrowserWarning } from "@/lib/telemetry.client";

async function audioInputs(): Promise<MediaDeviceInfo[]> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((device) => device.kind === "audioinput");
}

/** The microphone in use was unplugged: move to another one, or turn it off. */
async function replaceUnplugged(room: Room, track: LocalAudioTrack, inputs: MediaDeviceInfo[]) {
  const replacement = replacementMicrophone(inputs);
  if (!replacement) {
    await room.localParticipant.setMicrophoneEnabled(false);
    toast.error("Microfone desconectado. Conecte um e ligue o microfone de novo.", {
      id: MIC_ERROR_TOAST,
    });
    return;
  }
  await room.switchActiveDevice("audioinput", replacement.deviceId);
  // Muted, the SDK restarts the capture on the new device when it is turned on: no notice.
  if (track.isMuted) return;
  // Same "default" entry, now pointing elsewhere: switching was a no-op.
  if (track.mediaStreamTrack.readyState === "ended") await track.restartTrack();
  toast.info(`Microfone desconectado. Agora o som vem de ${replacement.label}.`);
}

/** Keeps the voice going when microphones come and go during the call. */
async function syncMicrophone(room: Room, track: LocalAudioTrack) {
  const inputs = await audioInputs();
  if (track.mediaStreamTrack.readyState === "ended") {
    await replaceUnplugged(room, track, inputs);
    return;
  }
  if (track.isMuted || room.getActiveDevice("audioinput") !== "default") return;
  const capturing = track.mediaStreamTrack.getSettings().groupId;
  if (defaultMovedAway(inputs, capturing)) await track.restartTrack();
}

/**
 * Chrome does not move a capture when its microphone is unplugged or when the system
 * default changes: the voice would just stop. This follows the change and says so.
 */
export function useMicrophoneRecovery() {
  const room = useRoomContext();
  const { microphoneTrack } = useLocalParticipant();
  const track = microphoneTrack?.track;

  useEffect(() => {
    if (!(track instanceof LocalAudioTrack)) return;
    let running: Promise<void> = Promise.resolve();
    let warned = false;
    const sync = () => {
      running = running
        .then(() => syncMicrophone(room, track))
        .catch((error: unknown) => {
          if (!warned) logBrowserWarning("Could not follow a microphone change", error);
          warned = true;
          toast.error("Não foi possível trocar o microfone. Escolha outro no menu do microfone.", {
            id: MIC_ERROR_TOAST,
          });
        });
    };
    track.on(TrackEvent.Ended, sync);
    room.on(RoomEvent.MediaDevicesChanged, sync);
    return () => {
      track.off(TrackEvent.Ended, sync);
      room.off(RoomEvent.MediaDevicesChanged, sync);
    };
  }, [room, track]);
}
