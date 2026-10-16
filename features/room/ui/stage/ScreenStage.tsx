import { VideoTrack, type TrackReference } from "@livekit/components-react";
import {
  Maximize2,
  Minimize2,
  MousePointerClick,
  PictureInPicture2,
  Activity,
  type LucideIcon,
} from "lucide-react";
import { useRef, useState, type RefObject } from "react";
import { Hint } from "@/components/Hint";
import { useRoomShortcut, useShortcutLabel } from "@/lib/hooks/use-shortcut-keys";
import { participantLabel } from "@/features/room/domain/participant-label";
import { usePageFullscreen } from "@/features/room/hooks/use-page-fullscreen";
import { usePictureInPicture } from "@/features/room/hooks/use-picture-in-picture";
import { cn } from "@/lib/utils";
import { PointerLayer, usePointers } from "./PointerLayer";
import { ScreenSoundControl } from "./ScreenVolume";
import { StreamMetrics } from "./StreamMetrics";
import { StopWatchingButton } from "./StopWatchingButton";
import { SharePicker } from "./SharePicker";
import { useBroadcastPresenterPing } from "@/features/room/hooks/use-presenter-ping";
import { useStageFocusAfterWatch } from "@/features/room/hooks/use-screen-watch";

import { useAnnotations } from "@/features/room/hooks/use-annotations";
import { AnnotationLayer } from "./AnnotationLayer";
import { AnnotationTools } from "./AnnotationTools";

interface ScreenStageProps {
  shares: TrackReference[];
  /** Screens shared by others that this viewer has not chosen to watch. */
  invites: TrackReference[];
  focused: TrackReference;
  onFocus: (trackSid: string) => void;
}

function StageButton({
  label,
  shortcut,
  icon: Icon,
  onPress,
}: {
  label: string;
  shortcut: string;
  icon: LucideIcon;
  onPress: () => void;
}) {
  return (
    <Hint text={`${label} (${shortcut})`}>
      <button
        type="button"
        onClick={onPress}
        aria-keyshortcuts={shortcut}
        aria-label={label}
        className="glass pointer-events-auto grid size-9 place-items-center rounded-xl text-ink-muted transition-colors hover:text-ink"
      >
        <Icon className="size-4" aria-hidden="true" />
      </button>
    </Hint>
  );
}

function FullscreenButton({
  isFullscreen,
  onToggle,
}: {
  isFullscreen: boolean;
  onToggle: () => void;
}) {
  const key = useShortcutLabel("fullscreen");
  return (
    <StageButton
      label={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
      shortcut={key}
      icon={isFullscreen ? Minimize2 : Maximize2}
      onPress={onToggle}
    />
  );
}

function PictureInPictureButton({ videoRef }: { videoRef: RefObject<HTMLVideoElement | null> }) {
  const { isPictureInPicture, canPictureInPicture, toggle } = usePictureInPicture(videoRef);
  useRoomShortcut("popout", () => void toggle(), canPictureInPicture);
  const popoutKey = useShortcutLabel("popout");

  if (!canPictureInPicture) return null;

  return (
    <StageButton
      label={isPictureInPicture ? "Fechar a janela" : "Abrir em janela"}
      shortcut={popoutKey}
      icon={PictureInPicture2}
      onPress={() => void toggle()}
    />
  );
}

function PointingButton({ pointing, onToggle }: { pointing: boolean; onToggle: () => void }) {
  const key = useShortcutLabel("point");
  return (
    <Hint text={pointing ? `Parar de apontar (${key})` : `Apontar na tela (${key})`}>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={pointing}
        aria-keyshortcuts={key}
        aria-label={pointing ? "Parar de apontar" : "Apontar na tela"}
        className={cn(
          "glass pointer-events-auto grid size-9 place-items-center rounded-xl transition-colors",
          pointing ? "bg-brand! text-brand-ink" : "text-ink-muted hover:text-ink",
        )}
      >
        <MousePointerClick className="size-4" aria-hidden="true" />
      </button>
    </Hint>
  );
}

/** The shared screen in focus, with its pointers, controls and screen picker. */
export function ScreenStage({ shares, invites, focused, onFocus }: ScreenStageProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showMetrics, setShowMetrics] = useState(false);
  // Pointing mode applies to the screen it was turned on for: switching screens turns it off.
  const [pointingAt, setPointingAt] = useState<string>();
  const { pings, pointAt } = usePointers();
  const { isFullscreen, canFullscreen, toggle: toggleFullscreen } = usePageFullscreen();
  const isOwnScreen = focused.participant.isLocal;
  const trackSid = focused.publication.trackSid;
  const sectionRef = useStageFocusAfterWatch(trackSid);
  const annotations = useAnnotations(trackSid, videoRef, isOwnScreen);
  const pointing = isPointing(isOwnScreen, pointingAt, trackSid, annotations.tool !== undefined);
  const togglePointing = () => {
    annotations.setTool(undefined);
    setPointingAt(pointing ? undefined : trackSid);
  };

  useBroadcastPresenterPing();
  useRoomShortcut("fullscreen", () => void toggleFullscreen(), canFullscreen);
  useRoomShortcut("point", togglePointing, !isOwnScreen);

  return (
    <section
      ref={sectionRef}
      tabIndex={-1}
      data-flip-id="stage"
      data-mascot-stage=""
      data-fullscreen={isFullscreen || undefined}
      aria-label={`Tela compartilhada por ${participantLabel(focused.participant)}`}
      className={cn(
        "relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-line bg-black shadow-soft outline-none",
        // Above the top bar, chat and dock; below tooltips (z-50) and notices.
        isFullscreen && "fixed inset-0 z-45 rounded-none border-0",
      )}
    >
      {isOwnScreen ? (
        // Your own screen at large size creates the mirror effect (screen within a screen).
        <div className="flex size-full flex-col items-center justify-center gap-4 bg-surface p-6 text-center">
          <div className="relative aspect-video w-full max-w-sm overflow-hidden rounded-xl border border-line bg-black">
            <VideoTrack
              ref={videoRef}
              trackRef={focused}
              className="size-full object-contain"
              aria-label="Prévia da sua tela"
            />
            <AnnotationLayer videoRef={videoRef} control={annotations} />
            <PointerLayer
              key={trackSid}
              videoRef={videoRef}
              trackSid={trackSid}
              pings={pings}
              pointing={false}
            />
          </div>
          <div className="flex max-w-sm flex-col gap-1.5">
            <p className="font-medium tracking-tight">Quem clicar em Assistir vê sua tela</p>
            <p className="text-sm text-ink-subtle">
              A prévia fica pequena para evitar o efeito espelho. Os pontos aparecem aqui.
            </p>
          </div>
        </div>
      ) : (
        <>
          <VideoTrack
            ref={videoRef}
            trackRef={focused}
            className="size-full object-contain"
            aria-label={`Tela de ${participantLabel(focused.participant)}`}
          />
          <AnnotationLayer videoRef={videoRef} control={annotations} />
          <PointerLayer
            // Another screen on stage: remount to measure the new video.
            key={trackSid}
            videoRef={videoRef}
            trackSid={trackSid}
            pings={pings}
            pointing={pointing}
            onPoint={pointAt}
          />
        </>
      )}

      <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-3">
        <span className="glass pointer-events-auto inline-flex min-w-0 items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-medium">
          <span className="size-2 shrink-0 rounded-full bg-brand-soft" aria-hidden="true" />
          <span className="truncate">
            {isOwnScreen
              ? "Você está apresentando"
              : `Tela de ${participantLabel(focused.participant)}`}
          </span>
        </span>

        <span className="flex shrink-0 gap-1 sm:gap-2">
          <AnnotationTools control={annotations} onStart={() => setPointingAt(undefined)} />
          <Hint text={showMetrics ? "Ocultar FPS e ping" : "Mostrar FPS e ping"}>
            <button
              type="button"
              aria-label={showMetrics ? "Ocultar FPS e ping" : "Mostrar FPS e ping"}
              onClick={() => setShowMetrics(!showMetrics)}
              className="glass pointer-events-auto grid size-9 place-items-center rounded-xl text-ink-muted hover:text-ink"
            >
              <Activity className="size-4" aria-hidden="true" />
            </button>
          </Hint>
          {isOwnScreen ? null : (
            <>
              <ScreenSoundControl
                // Another person's screen: "Voltar o som" must not bring back the last one's volume.
                key={focused.participant.identity}
                identity={focused.participant.identity}
                name={participantLabel(focused.participant)}
              />
              <PointingButton pointing={pointing} onToggle={togglePointing} />
              <StopWatchingButton trackSid={trackSid} />
            </>
          )}
          {/* Your own screen in a window would bring back the mirror effect. */}
          {isOwnScreen ? null : <PictureInPictureButton videoRef={videoRef} />}
          {canFullscreen ? (
            <FullscreenButton
              isFullscreen={isFullscreen}
              onToggle={() => void toggleFullscreen()}
            />
          ) : null}
        </span>
      </div>

      {showMetrics ? (
        <StreamMetrics
          key={trackSid}
          track={focused.publication.track}
          trackSid={trackSid}
          presenter={isOwnScreen ? undefined : focused.participant.identity}
        />
      ) : null}

      {pointing ? (
        <p className="glass pointer-events-none absolute top-14 right-3 rounded-xl px-3 py-1.5 text-xs font-medium">
          Clique na tela para apontar. Quem assiste vê o ponto.
        </p>
      ) : null}

      {shares.length + invites.length > 1 ? (
        <SharePicker shares={shares} invites={invites} focusedSid={trackSid} onFocus={onFocus} />
      ) : null}
    </section>
  );
}

function isPointing(
  own: boolean,
  pointingAt: string | undefined,
  trackSid: string,
  drawing: boolean,
) {
  if (drawing) return false;
  return !own && pointingAt === trackSid;
}
