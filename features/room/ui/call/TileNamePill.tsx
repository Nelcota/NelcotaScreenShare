import type { Participant } from "livekit-client";
import { useParticipantName } from "@/features/room/hooks/use-participant-name";
import { cn } from "@/lib/utils";
import { HostBadge } from "./HostBadge";
import { ParticipantAvatar } from "./ParticipantAvatar";
import { ParticipantCard } from "./ParticipantCard";

/** The name at the bottom of a large tile, with the photo when the camera covers the face. */
export function TileNamePill({
  participant,
  roomCode,
  withPhoto,
  shrunkOnPhone,
}: {
  participant: Participant;
  roomCode: string;
  withPhoto: boolean;
  shrunkOnPhone: boolean;
}) {
  const { name, label } = useParticipantName(participant);
  return (
    <span className="glass relative z-30 inline-flex min-w-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium">
      {withPhoto ? (
        <ParticipantCard participant={participant} roomCode={roomCode}>
          <ParticipantAvatar
            participant={participant}
            roomCode={roomCode}
            className="-ml-1.5 size-6 text-[0.625rem]"
          />
        </ParticipantCard>
      ) : null}
      <HostBadge identity={participant.identity} />
      {shrunkOnPhone ? <span className="sm:hidden">{label}</span> : null}
      <span className={cn("truncate", shrunkOnPhone && "max-sm:hidden")}>
        {name}
        {participant.isLocal ? <span className="font-normal text-ink-muted"> (você)</span> : null}
      </span>
    </span>
  );
}
