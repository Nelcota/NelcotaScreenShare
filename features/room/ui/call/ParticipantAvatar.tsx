import type { Participant } from "livekit-client";
import { useRouteLoaderData } from "react-router";
import { InitialsAvatar } from "@/components/InitialsAvatar";
import { participantPhotoPath } from "@/features/room/domain/participant-photo";
import { useParticipantName } from "@/features/room/hooks/use-participant-name";
import type { loader as rootLoader } from "@/app/root";

/**
 * Someone's face in the call. Your own photo comes from the page data; the others' from the
 * server, which only serves it to people in the same call. Guests keep their initials.
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
  const { name } = useParticipantName(participant);
  const account = useRouteLoaderData<typeof rootLoader>("root")?.account;
  const source = participant.isLocal
    ? (account?.image ?? null)
    : participantPhotoPath(roomCode, participant.identity);
  return <InitialsAvatar name={name} source={source} className={className} />;
}
