import type { Participant } from "livekit-client";
import { cn } from "@/lib/utils";
import { ParticipantCard } from "./ParticipantCard";

/**
 * A person's card surface. Pointing at it (mouse only) lights the border and lifts it a
 * little, so it reads as something to click; with reduced motion it only lights.
 */
export const TILE_SURFACE = cn(
  "relative flex size-full flex-col items-center justify-center overflow-hidden rounded-3xl border border-tile-line bg-tile shadow-soft",
  "transition-[translate,border-color] duration-200 group-hover/tile:-translate-y-0.5 group-hover/tile:border-brand/70 motion-reduce:group-hover/tile:translate-y-0",
);

/** Shows, on hover, that the card opens the person's profile; a click there opens it. */
export function ProfileHint({
  participant,
  roomCode,
}: {
  participant: Participant;
  roomCode: string;
}) {
  return (
    <ParticipantCard
      participant={participant}
      roomCode={roomCode}
      tabIndex={-1}
      label={(name) => `Ver perfil de ${name}`}
      className="glass absolute top-3 left-3 z-30 rounded-full px-3 py-1 text-xs font-medium opacity-0 transition-opacity duration-200 group-hover/tile:opacity-100"
    >
      Ver perfil
    </ParticipantCard>
  );
}
