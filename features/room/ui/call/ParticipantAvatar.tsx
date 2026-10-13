import type { Participant } from "livekit-client";
import { useState } from "react";
import { useRouteLoaderData } from "react-router";
import { participantName } from "@/features/room/domain/participant-label";
import { participantPhotoPath } from "@/features/room/domain/participant-photo";
import { initials } from "@/lib/initials";
import { cn } from "@/lib/utils";
import type { loader as rootLoader } from "@/app/root";

/**
 * Someone's face in the call: their initials, with the profile photo over them once it
 * loads. Your own photo comes from the page data; the others' from the server, which only
 * serves it to people in the same call. Guests and people without a photo keep the initials.
 */
export function ParticipantAvatar({
  participant,
  roomCode,
  className,
}: {
  participant: Participant;
  roomCode: string;
  className?: string;
}) {
  const account = useRouteLoaderData<typeof rootLoader>("root")?.account;
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const source = participant.isLocal
    ? (account?.image ?? null)
    : participantPhotoPath(roomCode, participant.identity);
  const showPhoto = source !== null && source !== failedSource;

  return (
    <span
      aria-hidden="true"
      className={cn("relative grid place-items-center overflow-hidden rounded-full", className)}
    >
      {initials(participantName(participant))}
      {showPhoto ? (
        <img
          key={source}
          data-slot="avatar-image"
          src={source}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailedSource(source)}
          className="absolute inset-0 size-full object-cover"
        />
      ) : null}
    </span>
  );
}
