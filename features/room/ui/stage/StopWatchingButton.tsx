import { EyeOff } from "lucide-react";
import { Hint } from "@/components/Hint";
import { useScreenWatch } from "@/features/room/hooks/use-screen-watch";

/** Cuts this screen's video and sound for this viewer; the call goes on. */
export function StopWatchingButton({ trackSid }: { trackSid: string }) {
  const { stopWatching } = useScreenWatch();
  return (
    <Hint text="Parar de assistir">
      <button
        type="button"
        aria-label="Parar de assistir"
        onClick={() => stopWatching(trackSid)}
        className="glass pointer-events-auto grid size-9 place-items-center rounded-xl text-ink-muted transition-colors hover:text-ink"
      >
        <EyeOff className="size-4" aria-hidden="true" />
      </button>
    </Hint>
  );
}
