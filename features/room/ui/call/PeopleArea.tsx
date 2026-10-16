import type { Participant } from "livekit-client";
import { useRef } from "react";
import { othersPresenting, peopleOrder } from "@/features/room/domain/people-order";
import { TILE_GAP, useTileGrid } from "@/features/room/hooks/use-tile-grid";
import { cn } from "@/lib/utils";
import { ParticipantTile } from "./ParticipantTile";

interface PeopleAreaProps {
  participants: Participant[];
  roomCode: string;
  sharingIds: Set<string>;
  /** Screens not watched here yet, by their sharer. */
  invites: ReadonlyMap<string, string>;
  hasStage: boolean;
  onEnlarge: (identity: string) => void;
}

/** With a stage: the side strip, people in a column next to the screen. */
function StageStrip({
  participants,
  roomCode,
  sharingIds,
  invites,
  onEnlarge,
}: Omit<PeopleAreaProps, "hasStage">) {
  return (
    <div
      data-mascot-participants=""
      className={cn(
        "flex shrink-0 gap-3 overflow-x-auto p-1 lg:w-48 lg:flex-col lg:gap-4 lg:overflow-x-visible lg:overflow-y-auto",
        // Phone on its side: the strip would leave the stage a sliver; the top bar lists people.
        "max-lg:[@media(max-height:32rem)]:hidden",
      )}
    >
      {peopleOrder(participants, sharingIds).map((participant) => (
        <ParticipantTile
          key={participant.identity}
          participant={participant}
          roomCode={roomCode}
          isSharing={sharingIds.has(participant.identity)}
          screenInvite={invites.get(participant.identity)}
          compact
          onEnlarge={() => onEnlarge(participant.identity)}
        />
      ))}
    </div>
  );
}

/**
 * Without a stage: the cards grow to fill the area, always 16:9, as in Discord (three
 * people go two above and one centered below).
 */
function TileGridArea({
  participants,
  roomCode,
  sharingIds,
  invites,
  onEnlarge,
}: Omit<PeopleAreaProps, "hasStage">) {
  const areaRef = useRef<HTMLDivElement>(null);
  const grid = useTileGrid(areaRef, participants.length);
  const shrinkOwn = othersPresenting(participants, sharingIds);
  return (
    <div
      ref={areaRef}
      className="flex min-h-0 w-full flex-1 flex-wrap content-center items-center justify-center"
      style={{ gap: TILE_GAP }}
    >
      {peopleOrder(participants, sharingIds).map((participant) => (
        <div
          key={participant.identity}
          // Before the first measure, a reasonable size instead of a jump from zero.
          className={cn(
            "min-w-0",
            !grid && "w-full max-w-md",
            shrinkOwn && participant.isLocal && "max-sm:w-1/2!",
          )}
          style={grid ? { width: grid.tileWidth } : undefined}
        >
          <ParticipantTile
            participant={participant}
            roomCode={roomCode}
            isSharing={sharingIds.has(participant.identity)}
            screenInvite={invites.get(participant.identity)}
            compact={false}
            shrunkOnPhone={shrinkOwn && participant.isLocal}
            onEnlarge={() => onEnlarge(participant.identity)}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * People: a grid without a stage; with a stage, a side strip. Whoever presents comes first;
 * while someone else presents, your own tile goes last and, on a phone, shrinks.
 */
export function PeopleArea({ hasStage, ...people }: PeopleAreaProps) {
  if (hasStage) return <StageStrip {...people} />;
  return <TileGridArea {...people} />;
}
