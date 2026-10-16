import { LocalAudioTrack, Track, type Room } from "livekit-client";
import { useEffect } from "react";
import {
  currentCamera,
  currentOutput,
  MEDIA_SETTINGS_EVENT,
  savedAudioProcessing,
  type MediaSettingKind,
} from "@/features/room/client/saved-media";
import { currentMicrophone } from "@/features/room/client/saved-microphone";
import { logBrowserWarning } from "@/lib/telemetry.client";

/** New clean-up options: the next capture uses them, and a live microphone restarts with them. */
async function applyProcessing(room: Room) {
  const processing = savedAudioProcessing();
  room.options.audioCaptureDefaults = { ...room.options.audioCaptureDefaults, ...processing };
  const track = room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track;
  if (!(track instanceof LocalAudioTrack) || track.isMuted) return;
  await track.restartTrack({ ...room.options.audioCaptureDefaults, ...processing });
}

/** The saved camera for the next capture, found by name when its id changed. */
async function applyCamera(room: Room) {
  const camera = await currentCamera();
  room.options.videoCaptureDefaults = { ...room.options.videoCaptureDefaults, deviceId: camera };
  if (camera) await room.switchActiveDevice("videoinput", camera);
}

async function apply(room: Room, kind: MediaSettingKind) {
  if (kind === "processing") return applyProcessing(room);
  if (kind === "output")
    return room.switchActiveDevice("audiooutput", (await currentOutput()) ?? "default");
  if (kind === "camera") return applyCamera(room);
  return room.switchActiveDevice("audioinput", (await currentMicrophone()) ?? "default");
}

/**
 * The call follows changes made in "Áudio e vídeo" (or anywhere else that saves a choice)
 * while it is open, even minimized behind the account page.
 */
export function useApplyMediaSettings(room: Room) {
  useEffect(() => {
    // The speaker and the camera saved by id may carry a new id in this session (Brave):
    // found by name once when the call opens; a device that is gone leaves the default.
    let running: Promise<unknown> = Promise.all([apply(room, "output"), applyCamera(room)]).catch(
      (error: unknown) => logBrowserWarning("Could not apply the saved devices", error),
    );
    const onChange = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const kind: unknown = event.detail;
      if (
        kind !== "microphone" &&
        kind !== "output" &&
        kind !== "camera" &&
        kind !== "processing"
      ) {
        return;
      }
      running = running
        .then(() => apply(room, kind))
        .catch((error: unknown) => logBrowserWarning("Could not apply a media setting", error));
    };
    window.addEventListener(MEDIA_SETTINGS_EVENT, onChange);
    return () => window.removeEventListener(MEDIA_SETTINGS_EVENT, onChange);
  }, [room]);
}
