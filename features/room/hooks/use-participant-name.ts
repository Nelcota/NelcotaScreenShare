import { useParticipantInfo } from "@livekit/components-react";
import type { Participant } from "livekit-client";
import { participantLabel, participantName } from "@/features/room/domain/participant-label";

/**
 * Someone's name in the call, redrawn when they rename themselves. LiveKit changes the name
 * on the same participant object, so a name derived from that object alone stays as it was
 * (the React Compiler keeps it while the object is the same).
 */
export function useParticipantName(participant: Participant) {
  const { name } = useParticipantInfo({ participant });
  const current = { identity: participant.identity, name, isLocal: participant.isLocal };
  return {
    /** The name with the guest mark: "Ana (sem conta)". */
    name: participantName(current),
    /** "Você" for yourself, the name for the others. */
    label: participantLabel(current),
    /** The name alone, as the person typed it. */
    plain: name || participant.identity,
  };
}
