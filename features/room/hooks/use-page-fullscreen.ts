import { useEffect, useSyncExternalStore } from "react";
import { callToast as toast } from "@/features/room/client/call-notices";
import { logBrowserWarning } from "@/lib/telemetry.client";

function subscribeFullscreen(onChange: () => void) {
  document.addEventListener("fullscreenchange", onChange);
  return () => document.removeEventListener("fullscreenchange", onChange);
}

/**
 * Fullscreen is the whole page with the stage covering it, not the stage element:
 * notices and tooltips live in portals on <body> and would be hidden otherwise.
 */
function isPageFullscreen(): boolean {
  return document.fullscreenElement === document.documentElement;
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await document.documentElement.requestFullscreen();
  } catch (error) {
    logBrowserWarning("Could not toggle fullscreen", error);
    toast.error("Não foi possível alternar a tela cheia.");
  }
}

async function exitFullscreen() {
  try {
    await document.exitFullscreen();
  } catch (error) {
    logBrowserWarning("Could not leave fullscreen", error);
  }
}

/** Whether the page is in the stage's fullscreen, for whoever sits under it. */
export function useIsPageFullscreen(): boolean {
  return useSyncExternalStore(subscribeFullscreen, isPageFullscreen, () => false);
}

/** Page fullscreen tied to the stage's lifetime. */
export function usePageFullscreen() {
  const isFullscreen = useIsPageFullscreen();

  // The stage leaves (the share ended): the page must not stay in fullscreen without it.
  useEffect(
    () => () => {
      if (isPageFullscreen()) void exitFullscreen();
    },
    [],
  );

  // iPhone Safari has no fullscreen for regular elements: no API, no button.
  return { isFullscreen, canFullscreen: document.fullscreenEnabled, toggle: toggleFullscreen };
}
