import { useEffect, useState, type RefObject } from "react";
import { useIsPageFullscreen } from "./use-page-fullscreen";

/** How long the dock stays over a fullscreen screen after the mouse stops. */
const FULLSCREEN_DOCK_MS = 3000;

/** Movement over the dock keeps it up: the person is about to use it. */
function isOnDock(dock: HTMLElement | null, target: EventTarget | null): boolean {
  if (dock === null) return false;
  if (!(target instanceof Node)) return false;
  return dock.contains(target);
}

/**
 * Over a fullscreen screen the dock hides; moving the mouse, a tap or the keyboard focus brings
 * it back for a few seconds, like a video player, so "Parar de assistir" stays at hand.
 */
export function useFullscreenDock(dock: RefObject<HTMLElement | null>) {
  const isFullscreen = useIsPageFullscreen();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!isFullscreen) return;
    let hideTimer: number | undefined;
    function show(event: Event) {
      window.clearTimeout(hideTimer);
      setShown(true);
      if (isOnDock(dock.current, event.target)) return;
      hideTimer = window.setTimeout(() => setShown(false), FULLSCREEN_DOCK_MS);
    }
    const events = ["pointermove", "pointerdown", "focusin"] as const;
    for (const name of events) document.addEventListener(name, show);
    return () => {
      window.clearTimeout(hideTimer);
      for (const name of events) document.removeEventListener(name, show);
      setShown(false);
    };
  }, [isFullscreen, dock]);

  return { isFullscreen, shown: isFullscreen && shown };
}
