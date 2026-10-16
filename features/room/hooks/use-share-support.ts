import { useSyncExternalStore } from "react";
import { subscribeNothing } from "@/lib/hooks/subscribe-nothing";
import {
  canRestrictOwnAudio,
  currentShareSupport,
  type ShareSupport,
} from "@/features/room/domain/share-support";

/**
 * What this browser can share. The server cannot know, so it is `null` until
 * hydration (nothing renders wrong text in the meantime).
 */
export function useShareSupport(): ShareSupport | null {
  return useSyncExternalStore<ShareSupport | null>(
    subscribeNothing,
    currentShareSupport,
    () => null,
  );
}

/** Can a whole screen go with sound here? `false` on the server: no promise before hydration. */
export function useScreenAudioSupport(): boolean {
  return useSyncExternalStore(subscribeNothing, screenAudioSupported, () => false);
}

function screenAudioSupported(): boolean {
  return (
    typeof navigator.mediaDevices?.getSupportedConstraints === "function" && canRestrictOwnAudio()
  );
}
