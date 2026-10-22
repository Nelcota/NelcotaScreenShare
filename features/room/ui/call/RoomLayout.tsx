import type { RoomTitle } from "@/features/room/domain/room-title";
import {
  useAudioPlayback,
  useConnectionState,
  useLocalParticipant,
  useParticipants,
  useTracks,
  type TrackReference,
} from "@livekit/components-react";
import { ConnectionState, Track } from "livekit-client";
import { Loader2, Volume2, WifiOff } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Mascot } from "@/features/mascot/ui/Mascot";
import type { MascotActivity } from "@/features/mascot/domain/personality";
import { useRoomAnimations } from "@/features/room/hooks/use-room-animations";
import { useRoomNotices } from "@/features/room/hooks/use-room-notices";
import { useViewerSounds } from "@/features/room/hooks/use-viewer-sounds";
import { useScreenShare } from "@/features/room/hooks/use-screen-share";
import { useCallCaptureHandle } from "@/features/room/hooks/use-call-capture-handle";
import { useEnlargedCamera } from "@/features/room/hooks/use-enlarged-camera";
import { useMicrophoneRecovery } from "@/features/room/hooks/use-microphone-recovery";
import { useStageFocus } from "@/features/room/hooks/use-stage-focus";
import { useScreenWatch } from "@/features/room/hooks/use-screen-watch";
import { useBroadcastScreenPreview } from "@/features/room/hooks/use-screen-preview";
import { useChatState } from "@/features/room/hooks/use-chat-state";
import { useHadCompany } from "@/features/room/hooks/use-had-company";
import { useConnectedOnce } from "@/features/room/hooks/use-connected-once";
import { useAnnounceCallConnected } from "@/features/ringing/client/call-connection";
import { othersInCall, peopleView } from "@/features/room/domain/room-company";
import { ChatPanel } from "@/features/room/ui/dock/Chat";
import { ControlDock } from "@/features/room/ui/dock/ControlDock";
import { watchedRemoteScreen } from "@/features/room/domain/watched-screen";
import { CameraStage } from "@/features/room/ui/stage/CameraStage";
import { ScreenStage } from "@/features/room/ui/stage/ScreenStage";
import { cn } from "@/lib/utils";
import { AloneWelcome } from "./AloneWelcome";
import { JoinRequests } from "./JoinRequests";
import { PeopleArea } from "./PeopleArea";
import { ParticipantTile } from "./ParticipantTile";
import { RoomTopBar } from "./RoomTopBar";

export type Connection = "connecting" | "reconnecting" | "connected";

function connectionStatus(state: ConnectionState): Connection {
  if (state === ConnectionState.Reconnecting || state === ConnectionState.SignalReconnecting) {
    return "reconnecting";
  }
  return state === ConnectionState.Connecting ? "connecting" : "connected";
}

/** Waiting while it connects, worried while the connection drops; the call decides once in. */
const CONNECTION_ACTIVITY: Partial<Record<Connection, MascotActivity>> = {
  connecting: "waiting",
  reconnecting: "worried",
};

/** Stacked notices: reconnection and blocked audio can appear together. */
function ConnectionNotices({ connection }: { connection: Connection }) {
  const { canPlayAudio, startAudio } = useAudioPlayback();
  const reconnecting = connection === "reconnecting";
  return (
    <div className="absolute top-20 left-1/2 z-40 flex -translate-x-1/2 flex-col items-center gap-2">
      {connection !== "connected" ? (
        <output aria-live="polite">
          <span className="glass flex items-center gap-2.5 rounded-full px-5 py-3 text-base font-medium">
            <Mascot
              className="size-14"
              sizes="168px"
              canSleep={false}
              activity={reconnecting ? "worried" : "waiting"}
            />
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
  welcome,
}: {
  connection: Connection;
  hasStage: boolean;
  alone: boolean;
  welcome: number;
}) {
  const activity = CONNECTION_ACTIVITY[connection] ?? (hasStage ? "presenting" : "idle");
  return (
    <div
      data-room-mascot=""
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
          welcome={welcome}
        />
      </div>
    </div>
  );
}

/**
 * An enlarged camera takes the stage; otherwise the focused screen. Without either, the
 * screens nobody here watches yet wait for "Assistir" on their sharer's tile.
 */
function Stage({
  enlargedCamera,
  onCloseCamera,
  stage,
  invites,
}: {
  enlargedCamera: TrackReference | undefined;
  onCloseCamera: () => void;
  stage: ReturnType<typeof useStageFocus>;
  invites: TrackReference[];
}) {
  if (enlargedCamera) return <CameraStage camera={enlargedCamera} onClose={onCloseCamera} />;
  if (!stage.focused) return null;
  return (
    <ScreenStage
      shares={stage.shares}
      invites={invites}
      focused={stage.focused}
      onFocus={stage.focus}
    />
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
  roomName: RoomTitle | null;
  isAdmin: boolean;
  onLeave: () => void;
}) {
  const scope = useRef<HTMLDivElement>(null);
  const connectionState = useConnectionState();
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const watch = useScreenWatch();
  const published = useTracks([Track.Source.ScreenShare], { onlySubscribed: false });
  const watching = (trackReference: TrackReference) =>
    trackReference.participant.isLocal || watch.isWatching(trackReference.publication.trackSid);
  // Only goes on stage once the video is available (avoids a black stage).
  const screenShares = published.filter(
    (trackReference) => watching(trackReference) && trackReference.publication.track !== undefined,
  );
  const invites = published.filter((trackReference) => !watching(trackReference));
  const chat = useChatState();
  const share = useScreenShare();
  useCallCaptureHandle();
  useMicrophoneRecovery();
  const welcome = useRoomNotices();
  useViewerSounds();
  useBroadcastScreenPreview(published.find((trackReference) => trackReference.participant.isLocal));

  const stage = useStageFocus(screenShares);
  const focused = stage.focused;
  // Someone else's screen you watch: the dock offers to stop watching it.
  const watchedScreen = watchedRemoteScreen(focused, screenShares);
  const enlarged = useEnlargedCamera();
  const hasStage = focused !== undefined || enlarged.camera !== undefined;
  const sharingIds = new Set(
    published.map((trackReference) => trackReference.participant.identity),
  );

  const connection = connectionStatus(connectionState);
  const connectedOnce = useConnectedOnce(connectionState);
  useAnnounceCallConnected(code, connectedOnce);
  const others = othersInCall(
    localParticipant.identity,
    participants.filter((participant) => !participant.isLocal).map(({ identity }) => identity),
  );
  const view = peopleView({ connectedOnce, hasStage, others });
  const alone = view === "alone";
  const hadCompany = useHadCompany({ connectedOnce, others });

  const layoutKey = `${hasStage ? "stage" : view}|${participants.map((participant) => participant.identity).join(",")}|chat:${chat.open}`;
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
          // Phones: "Parar de assistir" sits above the dock, so the content ends higher.
          watchedScreen && "max-sm:pb-44",
        )}
      >
        {/* Alone, the welcome's title is the page's heading; with company, this one. */}
        {alone ? null : <h1 className="sr-only">Chamada</h1>}
        <Stage
          enlargedCamera={enlarged.camera}
          onCloseCamera={enlarged.close}
          stage={stage}
          invites={invites}
        />

        {alone ? (
          <AloneWelcome
            code={code}
            everyoneLeft={hadCompany}
            tile={
              <ParticipantTile
                participant={localParticipant}
                roomCode={code}
                isSharing={sharingIds.has(localParticipant.identity)}
                compact={false}
                onEnlarge={() => enlarged.enlarge(localParticipant.identity)}
              />
            }
          />
        ) : null}
        {view === "grid" ? (
          <PeopleArea
            participants={participants}
            roomCode={code}
            sharingIds={sharingIds}
            invites={
              new Map(
                invites.map((invite) => [invite.participant.identity, invite.publication.trackSid]),
              )
            }
            hasStage={hasStage}
            onEnlarge={enlarged.enlarge}
          />
        ) : null}
      </main>

      <CornerMascot connection={connection} hasStage={hasStage} alone={alone} welcome={welcome} />
      <ChatPanel chat={chat} roomCode={code} />
      <ControlDock chat={chat} share={share} watchedScreen={watchedScreen} onLeave={onLeave} />
    </div>
  );
}
