import { EyeOff } from "lucide-react";
import { useScreenWatch } from "@/features/room/hooks/use-screen-watch";
import { DockButton } from "./DockButton";

/**
 * While you watch someone's screen: stop watching it from the dock, red like "Mudo", so it is
 * found without looking for the small eye on the screen. Assistir brings it back.
 */
export function StopWatchingDockButton({ trackSid }: { trackSid: string }) {
  const { stopWatching } = useScreenWatch();
  return (
    <DockButton
      label="Parar de assistir"
      tone="muted"
      caption="Parar de assistir"
      shortCaption="Parar"
      onClick={() => stopWatching(trackSid)}
    >
      <EyeOff className="size-5" aria-hidden="true" />
    </DockButton>
  );
}

/** Phones: the dock has no room for one more button, so it sits just above it. */
export function StopWatchingPill({ trackSid }: { trackSid: string }) {
  const { stopWatching } = useScreenWatch();
  return (
    <button
      type="button"
      onClick={() => stopWatching(trackSid)}
      className="glass pointer-events-auto inline-flex items-center gap-2 rounded-full border-danger/30 bg-danger/15 px-4 py-2 text-sm font-medium text-danger hover:bg-danger/25 sm:hidden"
    >
      <EyeOff className="size-4" aria-hidden="true" />
      Parar de assistir
    </button>
  );
}
