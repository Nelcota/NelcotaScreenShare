import type { Participant } from "livekit-client";
import { VolumeX } from "lucide-react";
import { useParticipantAudio } from "@/features/room/hooks/use-participant-audio";
import { cn } from "@/lib/utils";

/**
 * Amber mark on someone's tile while you silenced them only for you, since the tile has no
 * sound button. Nobody else sees it. `large` spells it out, the small tiles only show the icon.
 */
export function SilencedBadge({
  participant,
  name,
  large = false,
  className,
}: {
  participant: Participant;
  name: string;
  large?: boolean;
  className?: string;
}) {
  const { settings } = useParticipantAudio(participant.identity);
  if (participant.isLocal || !settings.muted) return null;
  if (!large) {
    return (
      <span
        className={cn(
          "grid size-6 place-items-center rounded-full bg-warning text-canvas",
          className,
        )}
      >
        <VolumeX className="size-3.5" aria-hidden="true" />
        <span className="sr-only">Você silenciou {name}</span>
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full bg-warning/15 px-2 text-sm font-medium text-warning sm:px-3",
        className,
      )}
    >
      <VolumeX className="size-4" aria-hidden="true" />
      <span aria-hidden="true" className="max-sm:hidden">
        Você silenciou
      </span>
      <span className="sr-only">Você silenciou {name}</span>
    </span>
  );
}
