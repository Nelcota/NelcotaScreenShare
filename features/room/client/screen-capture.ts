import {
  LocalAudioTrack,
  LocalVideoTrack,
  Track,
  TrackInvalidError,
  type LocalTrack,
  type ScreenShareCaptureOptions,
} from "livekit-client";
import {
  currentShareSupport,
  type WindowAudioPreference,
} from "@/features/room/domain/share-support";

export interface ScreenCaptureOptions extends ScreenShareCaptureOptions {
  /** Sound offered for a window. LiveKit does not forward it, hence this capture. */
  windowAudio: WindowAudioPreference;
}

type DisplayMediaOptions = DisplayMediaStreamOptions & {
  selfBrowserSurface?: "include" | "exclude";
  surfaceSwitching?: "include" | "exclude";
  systemAudio?: "include" | "exclude";
  windowAudio?: WindowAudioPreference;
};

/**
 * The video constraints LiveKit's `createScreenTracks` builds: an ideal size, or a maximum
 * on Safari, which otherwise ignores it.
 */
function videoConstraints(
  options: ScreenCaptureOptions,
  safari: boolean,
): boolean | MediaTrackConstraints {
  const base = options.video ?? true;
  const resolution = options.resolution;
  if (!resolution || resolution.width <= 0 || resolution.height <= 0) return base;
  const video = typeof base === "boolean" ? {} : base;
  const size = safari
    ? { width: { max: resolution.width }, height: { max: resolution.height } }
    : { width: { ideal: resolution.width }, height: { ideal: resolution.height } };
  return { ...video, ...size, frameRate: resolution.frameRate };
}

/** What `getDisplayMedia` receives: LiveKit's options plus `windowAudio`. */
export function displayMediaOptions(
  options: ScreenCaptureOptions,
  safari: boolean,
): DisplayMediaOptions {
  return {
    audio: options.audio ?? false,
    video: videoConstraints(options, safari),
    selfBrowserSurface: options.selfBrowserSurface,
    surfaceSwitching: options.surfaceSwitching,
    systemAudio: options.systemAudio,
    windowAudio: options.windowAudio,
  };
}

/**
 * Opens the browser picker and wraps what comes back as LiveKit tracks, the way
 * `localParticipant.createScreenTracks` does, so a shared window can carry its sound.
 */
export async function captureScreenTracks(options: ScreenCaptureOptions): Promise<LocalTrack[]> {
  const safari = currentShareSupport() === "safari";
  const stream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions(options, safari));
  const [videoTrack] = stream.getVideoTracks();
  if (videoTrack === undefined) throw new TrackInvalidError("no video track found");

  const video = new LocalVideoTrack(videoTrack, undefined, false);
  video.source = Track.Source.ScreenShare;
  if (options.contentHint) video.mediaStreamTrack.contentHint = options.contentHint;

  const [audioTrack] = stream.getAudioTracks();
  if (audioTrack === undefined) return [video];
  const audio = new LocalAudioTrack(audioTrack, undefined, false);
  audio.source = Track.Source.ScreenShareAudio;
  return [video, audio];
}
