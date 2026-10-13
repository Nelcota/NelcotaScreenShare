import { useEffect, useSyncExternalStore, type RefObject } from "react";
import { callToast as toast } from "@/features/room/client/call-notices";
import { logBrowserWarning } from "@/lib/telemetry.client";

// Both events bubble from the video up to the document.
function subscribePictureInPicture(onChange: () => void) {
  document.addEventListener("enterpictureinpicture", onChange);
  document.addEventListener("leavepictureinpicture", onChange);
  return () => {
    document.removeEventListener("enterpictureinpicture", onChange);
    document.removeEventListener("leavepictureinpicture", onChange);
  };
}

function isInPictureInPicture(): boolean {
  return document.pictureInPictureElement != null;
}

async function togglePictureInPicture(video: HTMLVideoElement | null) {
  try {
    if (isInPictureInPicture()) {
      await document.exitPictureInPicture();
      return;
    }
    if (video === null) return;
    await video.requestPictureInPicture();
  } catch (error) {
    logBrowserWarning("Could not toggle picture-in-picture", error);
    toast.error("Não foi possível abrir a tela em janela.");
  }
}

async function exitPictureInPicture() {
  try {
    await document.exitPictureInPicture();
  } catch (error) {
    logBrowserWarning("Could not close picture-in-picture", error);
  }
}

/**
 * Shared screen in a floating window above other apps, so the call can be followed
 * from another tab. LiveKit keeps the video flowing while it is in the window.
 */
export function usePictureInPicture(videoRef: RefObject<HTMLVideoElement | null>) {
  const isPictureInPicture = useSyncExternalStore(
    subscribePictureInPicture,
    isInPictureInPicture,
    () => false,
  );

  // The stage leaves (the share ended): the window must not stay open without it.
  useEffect(
    () => () => {
      if (isInPictureInPicture()) void exitPictureInPicture();
    },
    [],
  );

  // Firefox has its own window button on the video, without the API: no button here.
  return {
    isPictureInPicture,
    canPictureInPicture: "pictureInPictureEnabled" in document && document.pictureInPictureEnabled,
    toggle: () => togglePictureInPicture(videoRef.current),
  };
}
