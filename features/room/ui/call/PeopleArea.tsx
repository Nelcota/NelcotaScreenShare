import type { Participant } from "livekit-client";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { useRef } from "react";
import { Hint } from "@/components/Hint";
import { Button } from "@/components/ui/button";
import { othersPresenting, peopleOrder } from "@/features/room/domain/people-order";
import { usePeopleStrip } from "@/features/room/hooks/use-people-strip";
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

/** The column's own button: shrinks it to the photos, or brings the names back. */
function ShrinkButton({ shrunk, onToggle }: { shrunk: boolean; onToggle: () => void }) {
  const label = shrunk ? "Mostrar os nomes" : "Encolher a lista de pessoas";
  return (
    <Hint text={label} side="left">
      <Button
        type="button"
        variant="quiet"
        size="icon-lg"
        aria-label={label}
        onClick={onToggle}
        className={cn("shrink-0", shrunk ? "self-center" : "self-end")}
      >
        {shrunk ? <PanelRightOpen aria-hidden="true" /> : <PanelRightClose aria-hidden="true" />}
      </Button>
    </Hint>
  );
}

/**
 * With a stage: the side strip, people in a column next to the screen. In a small window the
 * column can shrink to the photos, so the screen gets the room.
 */
function StageStrip({
  participants,
  roomCode,
  sharingIds,
  invites,
  onEnlarge,
}: Omit<PeopleAreaProps, "hasStage">) {
  const strip = usePeopleStrip();
  return (
    <div
      data-mascot-participants=""
      className={cn(
        "flex shrink-0 gap-3 overflow-x-auto p-1 lg:flex-col lg:gap-4 lg:overflow-x-visible lg:overflow-y-auto",
        strip.shrunk ? "lg:w-[4.75rem] lg:items-center" : "lg:w-60",
        // Phone on its side: the strip would leave the stage a sliver; the top bar lists people.
        "max-lg:[@media(max-height:32rem)]:hidden",
      )}
    >
      {strip.column ? <ShrinkButton shrunk={strip.shrunk} onToggle={strip.toggle} /> : null}
      {peopleOrder(participants, sharingIds).map((participant) => (
        <ParticipantTile
          key={participant.identity}
          participant={participant}
          roomCode={roomCode}
          isSharing={sharingIds.has(participant.identity)}
          screenInvite={invites.get(participant.identity)}
          compact
          narrow={strip.shrunk}
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
