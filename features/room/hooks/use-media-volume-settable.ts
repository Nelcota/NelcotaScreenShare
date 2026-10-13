import { useSyncExternalStore } from "react";
import { subscribeNothing } from "@/lib/hooks/subscribe-nothing";

let volumeSettable: boolean | undefined;

/** iPhone and iPad leave media volume to the hardware buttons: setting it does nothing. */
function mediaVolumeSettable(): boolean {
  if (volumeSettable !== undefined) return volumeSettable;
  const probe = new Audio();
  probe.volume = 0.5;
  volumeSettable = probe.volume === 0.5;
  return volumeSettable;
}

/** Whether a volume slider has any effect in this browser (false on the server). */
export function useMediaVolumeSettable(): boolean {
  return useSyncExternalStore(subscribeNothing, mediaVolumeSettable, () => false);
}
