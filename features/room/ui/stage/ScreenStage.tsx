import { VideoTrack, type TrackReference } from "@livekit/components-react";
import {
  Maximize2,
  Minimize2,
  MonitorUp,
  MousePointerClick,
  PictureInPicture2,
  Activity,
  type LucideIcon,
} from "lucide-react";
import { useRef, useState, type RefObject } from "react";
import { Hint } from "@/components/Hint";
import { useShortcut } from "@/lib/hooks/use-shortcut";
import { participantLabel } from "@/features/room/domain/participant-label";
import { usePageFullscreen } from "@/features/room/hooks/use-page-fullscreen";
import { usePictureInPicture } from "@/features/room/hooks/use-picture-in-picture";
import { cn } from "@/lib/utils";
import { PointerLayer, usePointers } from "./PointerLayer";
import { StreamMetrics } from "./StreamMetrics";
import { useBroadcastPresenterPing } from "@/features/room/hooks/use-presenter-ping";

interface ScreenStageProps {
  shares: TrackReference[];
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
  return (
    <StageButton
      label={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
      shortcut="F"
      icon={isFullscreen ? Minimize2 : Maximize2}
      onPress={onToggle}
    />
  );
}

function PictureInPictureButton({ videoRef }: { videoRef: RefObject<HTMLVideoElement | null> }) {
  const { isPictureInPicture, canPictureInPicture, toggle } = usePictureInPicture(videoRef);
  useShortcut("j", () => void toggle(), canPictureInPicture);

  if (!canPictureInPicture) return null;

  return (
    <StageButton
      label={isPictureInPicture ? "Fechar a janela" : "Abrir em janela"}
      shortcut="J"
      icon={PictureInPicture2}
      onPress={() => void toggle()}
    />
  );
}

function PointingButton({ pointing, onToggle }: { pointing: boolean; onToggle: () => void }) {
  return (
    <Hint text={pointing ? "Parar de apontar (P)" : "Apontar na tela (P)"}>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={pointing}
        aria-keyshortcuts="P"
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

function SharePicker({
  shares,
  focusedSid,
  onFocus,
}: {
  shares: TrackReference[];
  focusedSid: string;
  onFocus: (trackSid: string) => void;
}) {
  return (
    <fieldset
      // Plain toggle buttons: a tablist promises arrow keys and a tabpanel.
      aria-label="Escolher a tela compartilhada"
      className="glass absolute bottom-3 left-1/2 flex max-w-[calc(100%-1.5rem)] min-w-0 -translate-x-1/2 gap-1 overflow-x-auto rounded-xl p-1"
    >
      {shares.map((share) => {
        const trackSid = share.publication.trackSid;
        const active = trackSid === focusedSid;
        return (
          <button
            key={trackSid}
            type="button"
            aria-pressed={active}
            onClick={() => onFocus(trackSid)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
              active
                ? "bg-brand text-brand-ink"
                : "text-ink-muted hover:bg-surface-3 hover:text-ink",
            )}
          >
            <MonitorUp className="size-3.5" aria-hidden="true" />
            {participantLabel(share.participant)}
          </button>
        );
      })}
    </fieldset>
  );
}

/** The shared screen in focus, with its pointers, controls and screen picker. */
export function ScreenStage({ shares, focused, onFocus }: ScreenStageProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showMetrics, setShowMetrics] = useState(false);
  // Pointing mode applies to the screen it was turned on for: switching screens turns it off.
  const [pointingAt, setPointingAt] = useState<string>();
  const { pings, pointAt } = usePointers();
  const { isFullscreen, canFullscreen, toggle: toggleFullscreen } = usePageFullscreen();
  const isOwnScreen = focused.participant.isLocal;
  const trackSid = focused.publication.trackSid;
  const pointing = !isOwnScreen && pointingAt === trackSid;
  const togglePointing = () => setPointingAt(pointing ? undefined : trackSid);

  useBroadcastPresenterPing();
  useShortcut("f", () => void toggleFullscreen(), canFullscreen);
  useShortcut("p", togglePointing, !isOwnScreen);

  return (
    <section
      data-flip-id="stage"
      data-mascot-stage=""
      data-fullscreen={isFullscreen || undefined}
      aria-label={`Tela compartilhada por ${participantLabel(focused.participant)}`}
      className={cn(
        "relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-line bg-black shadow-soft",
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
            <PointerLayer
              key={trackSid}
              videoRef={videoRef}
              trackSid={trackSid}
              pings={pings}
              pointing={false}
            />
          </div>
          <div className="flex max-w-sm flex-col gap-1.5">
            <p className="font-medium tracking-tight">Todos na sala estão vendo sua tela</p>
            <p className="text-sm text-ink-subtle">
              A prévia fica pequena para evitar o efeito espelho. Quando alguém apontar algo, o
              ponto aparece aqui.
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
          <Hint text={showMetrics ? "Ocultar FPS e ping" : "Mostrar FPS e ping"}>
            <button
              type="button"
              aria-label={showMetrics ? "Ocultar FPS e ping" : "Mostrar FPS e ping"}
              aria-pressed={showMetrics}
              onClick={() => setShowMetrics(!showMetrics)}
              className="glass pointer-events-auto grid size-9 place-items-center rounded-xl text-ink-muted hover:text-ink"
            >
              <Activity className="size-4" aria-hidden="true" />
            </button>
          </Hint>
          {isOwnScreen ? null : <PointingButton pointing={pointing} onToggle={togglePointing} />}
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
          Clique na tela (ou use as setas e Enter) para apontar. Todos veem o ponto.
        </p>
      ) : null}

      {shares.length > 1 ? (
        <SharePicker shares={shares} focusedSid={trackSid} onFocus={onFocus} />
      ) : null}
    </section>
  );
}
