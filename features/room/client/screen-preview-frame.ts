import { logBrowserWarning } from "@/lib/telemetry.client";

/** Small and already blurred on the sharer's side: a hint of the screen, never its text. */
const PREVIEW_WIDTH = 160;
const PREVIEW_QUALITY = 0.5;
const PREVIEW_BLUR = "blur(2px)";

/** Reads frames from this browser's own screen track: nothing leaves until one is sent. */
export interface ScreenFrameSource {
  /** A tiny blurred image of the screen now, or `undefined` while there is none. */
  grab: () => string | undefined;
  stop: () => void;
}

function encode(canvas: HTMLCanvasElement): string | undefined {
  const webp = canvas.toDataURL("image/webp", PREVIEW_QUALITY);
  // A browser without WebP returns PNG, far too big: JPEG instead.
  if (webp.startsWith("data:image/webp")) return webp;
  const jpeg = canvas.toDataURL("image/jpeg", PREVIEW_QUALITY);
  if (jpeg.startsWith("data:image/jpeg")) return jpeg;
  return undefined;
}

/** Plays the screen track in a hidden video and draws a tiny copy of it on demand. */
export function screenFrameSource(track: MediaStreamTrack): ScreenFrameSource {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.srcObject = new MediaStream([track]);
  video.play().catch((error: unknown) => {
    logBrowserWarning("Could not read the shared screen for its preview", error);
  });
  const canvas = document.createElement("canvas");

  return {
    grab() {
      if (video.videoWidth === 0 || video.videoHeight === 0) return undefined;
      const context = canvas.getContext("2d");
      if (!context) return undefined;
      canvas.width = PREVIEW_WIDTH;
      canvas.height = Math.max(
        1,
        Math.round((PREVIEW_WIDTH * video.videoHeight) / video.videoWidth),
      );
      context.filter = PREVIEW_BLUR;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      return encode(canvas);
    },
    stop() {
      video.pause();
      video.srcObject = null;
    },
  };
}
