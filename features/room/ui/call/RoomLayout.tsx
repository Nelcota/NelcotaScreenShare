import {
  useAudioPlayback,
  useConnectionState,
  useParticipants,
  useTracks,
} from "@livekit/components-react";
import { ConnectionState, Track, type Participant } from "livekit-client";
import { Loader2, Volume2, WifiOff } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Mascot } from "@/features/mascot/ui/Mascot";
import { useRoomAnimations } from "@/features/room/hooks/use-room-animations";
import { useRoomNotices } from "@/features/room/hooks/use-room-notices";
import { useScreenShare } from "@/features/room/hooks/use-screen-share";
import { useStageFocus } from "@/features/room/hooks/use-stage-focus";
import { useChatState } from "@/features/room/hooks/use-chat-state";
import { useHadCompany } from "@/features/room/hooks/use-had-company";
import { ChatPanel } from "@/features/room/ui/dock/Chat";
import { ControlDock } from "@/features/room/ui/dock/ControlDock";
import { ScreenStage } from "@/features/room/ui/stage/ScreenStage";
import { cn } from "@/lib/utils";
import { AloneWelcome } from "./AloneWelcome";
import { JoinRequests } from "./JoinRequests";
import { ParticipantTile } from "./ParticipantTile";
import { RoomTopBar } from "./RoomTopBar";

export type Connection = "connecting" | "reconnecting" | "connected";

function connectionStatus(state: ConnectionState): Connection {
  if (state === ConnectionState.Reconnecting || state === ConnectionState.SignalReconnecting) {
    return "reconnecting";
  }
  return state === ConnectionState.Connecting ? "connecting" : "connected";
}

/** Stacked notices: reconnection and blocked audio can appear together. */
function ConnectionNotices({ connection }: { connection: Connection }) {
  const { canPlayAudio, startAudio } = useAudioPlayback();
  const reconnecting = connection === "reconnecting";
  return (
    <div className="absolute top-20 left-1/2 z-40 flex -translate-x-1/2 flex-col items-center gap-2">
      {connection !== "connected" ? (
        <output aria-live="polite">
          <span className="glass flex items-center gap-2.5 rounded-full px-5 py-3 text-base font-medium">
            <Mascot className="size-14" sizes="168px" canSleep={false} activity="waiting" />
            {reconnecting ? <WifiOff className="size-5 text-warning" aria-hidden="true" /> : null}
            <Loader2 className="size-5 animate-spin text-ink-muted" aria-hidden="true" />
            {reconnecting ? "Conexão instável. Reconectando…" : "Conectando…"}
          </span>
        </output>
      ) : null}
      {!canPlayAudio ? (
        <Button onClick={() => void startAudio()} size="lg">
          <Volume2 aria-hidden="true" />
          Ativar áudio da sala
        </Button>
      ) : null}
    </div>
  );
}

/**
 * The call's mascot, in the bottom-left corner, away from the dock (center) and the chat
 * (right). Always mounted and outside the layout animations: remounting it on every share
 * or layout change restarted its pose, which looked like a glitch. Alone, the welcome has
 * its own; phones have no free corner, so it stays out there.
 */
function CornerMascot({
  connection,
  hasStage,
  alone,
}: {
  connection: Connection;
  hasStage: boolean;
  alone: boolean;
}) {
  const activity = connection !== "connected" ? "waiting" : hasStage ? "presenting" : "idle";
  return (
    <div
      hidden={alone}
      className={cn(
        "pointer-events-none fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-6 z-30 max-lg:hidden",
        // Clears the browser's "sharing your screen" bar, like the dock.
        "group-data-capture-bar/room:bottom-14 [@media(max-height:32rem)]:hidden",
      )}
    >
      <div className="pointer-events-auto">
        <Mascot
          className="size-20"
          sizes="240px"
          canSleep={false}
          facing="right"
          activity={activity}
        />
      </div>
    </div>
  );
}

/** People: a grid without a stage; with a stage, a side strip. */
function PeopleArea({
  participants,
  roomCode,
  sharingIds,
  hasStage,
}: {
  participants: Participant[];
  roomCode: string;
  sharingIds: Set<string>;
  hasStage: boolean;
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
          : "grid w-full max-w-5xl content-center gap-4",
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
          compact={hasStage}
        />
      ))}
    </div>
  );
}

/** The connected room: top bar, stage (focused screen), people, chat and controls. */
export function RoomLayout({
  code,
  maxParticipants,
  roomName,
  isAdmin,
  onLeave,
}: {
  code: string;
  maxParticipants: number;
  roomName: string | null;
  isAdmin: boolean;
  onLeave: () => void;
}) {
  const scope = useRef<HTMLDivElement>(null);
  const connectionState = useConnectionState();
  const participants = useParticipants();
  // Only goes on stage once the video is available (avoids a black stage).
  const screenShares = useTracks([Track.Source.ScreenShare]).filter(
    (trackReference) => trackReference.publication.track !== undefined,
  );
  const chat = useChatState();
  const share = useScreenShare();
  useRoomNotices();

  const stage = useStageFocus(screenShares);
  const focused = stage.focused;
  const hasStage = focused !== undefined;
  const sharingIds = new Set(
    screenShares.map((trackReference) => trackReference.participant.identity),
  );

  const connection = connectionStatus(connectionState);
  const alone =
    !hasStage && participants.length === 1 && connectionState === ConnectionState.Connected;
  const hadCompany = useHadCompany(participants.length);

  const layoutKey = `${hasStage ? "stage" : alone ? "alone" : "grid"}|${participants.map((participant) => participant.identity).join(",")}|chat:${chat.open}`;
  useRoomAnimations(scope, layoutKey);

  return (
    <div
      ref={scope}
      // The browser's sharing bar sits over the bottom of the page: dock, chat and content rise.
      data-capture-bar={share.captureBar || undefined}
      className="group/room relative flex h-dvh flex-col overflow-hidden bg-canvas"
    >
      <header
        data-anim="topbar"
        className={cn(
          "room-topbar relative z-20 px-3 pt-3 sm:px-6 sm:pt-4",
          chat.open && "lg:pr-[26.5rem]",
        )}
      >
        <RoomTopBar
          code={code}
          participants={participants}
          maxParticipants={maxParticipants}
          roomName={roomName}
          isAdmin={isAdmin}
          connection={connection}
        />
      </header>

      <ConnectionNotices connection={connection} />
      <JoinRequests code={code} />

      <main
        className={cn(
          "relative z-10 flex min-h-0 flex-1 gap-4 px-3 pt-4 pb-32 sm:px-6",
          // Short screens: the dock drops its captions, so less room is reserved for it.
          "[@media(max-height:32rem)]:pt-2 [@media(max-height:32rem)]:pb-20",
          "group-data-capture-bar/room:pb-42 [@media(max-height:32rem)]:group-data-capture-bar/room:pb-30",
          // Stage in fullscreen: its stacking context has to rise above the top bar and dock.
          "has-data-fullscreen:z-45",
          hasStage ? "flex-col lg:flex-row" : "flex-col items-center justify-center",
          // Chat open on a wide screen: the content makes room instead of sitting underneath.
          chat.open && "lg:pr-[26.5rem]",
        )}
      >
        {focused ? (
          <ScreenStage shares={stage.shares} focused={focused} onFocus={stage.focus} />
        ) : null}

        {alone ? (
          <AloneWelcome code={code} share={share} everyoneLeft={hadCompany} />
        ) : (
          <PeopleArea
            participants={participants}
            roomCode={code}
            sharingIds={sharingIds}
            hasStage={hasStage}
          />
        )}
      </main>

      <CornerMascot connection={connection} hasStage={hasStage} alone={alone} />
      <ChatPanel chat={chat} />
      <ControlDock chat={chat} share={share} onLeave={onLeave} />
    </div>
  );
}
