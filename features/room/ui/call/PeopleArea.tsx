import type { Participant } from "livekit-client";
import { cn } from "@/lib/utils";
import { ParticipantTile } from "./ParticipantTile";

/** People: a grid without a stage; with a stage, a side strip. */
export function PeopleArea({
  participants,
  roomCode,
  sharingIds,
  invites,
  hasStage,
  onEnlarge,
}: {
  participants: Participant[];
  roomCode: string;
  sharingIds: Set<string>;
  /** Screens not watched here yet, by their sharer. */
  invites: ReadonlyMap<string, string>;
  hasStage: boolean;
  onEnlarge: (identity: string) => void;
}) {
  return (
    <div
      className={cn(
        hasStage
          ? cn(
              "flex shrink-0 gap-3 overflow-x-auto p-1 lg:w-48 lg:flex-col lg:gap-4 lg:overflow-x-visible lg:overflow-y-auto",
              // Phone on its side: the strip would leave the stage a sliver; the top bar lists people.
              "max-lg:[@media(max-height:32rem)]:hidden",
            )
          : // More air between tiles; each keeps 16:9 instead of filling the height.
            "grid w-full max-w-5xl content-center gap-x-8 gap-y-6",
        !hasStage && participants.length <= 2 && "max-w-4xl grid-cols-1 sm:grid-cols-2",
        !hasStage && participants.length >= 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
      )}
    >
      {participants.map((participant) => (
        <ParticipantTile
          key={participant.identity}
          participant={participant}
          roomCode={roomCode}
          isSharing={sharingIds.has(participant.identity)}
          screenInvite={invites.get(participant.identity)}
          compact={hasStage}
          onEnlarge={() => onEnlarge(participant.identity)}
        />
      ))}
    </div>
  );
}
