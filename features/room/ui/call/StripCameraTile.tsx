import type { TrackReference } from "@livekit/components-react";
import type { Participant } from "livekit-client";
import { Hand, MonitorUp } from "lucide-react";
import type { RefObject } from "react";
import { CameraVideo, EnlargeButton } from "./camera-face";
import { HostBadge } from "./HostBadge";
import { SilencedBadge } from "./SilencedBadge";
import { SoundBadge } from "./SoundBadge";

interface StripCameraTileProps {
  scope: RefObject<HTMLDivElement | null>;
  participant: Participant;
  camera: TrackReference;
  name: string;
  label: string;
  muted: boolean;
  deafened: boolean;
  isSharing: boolean;
  handRaised: boolean;
  isSpeaking: boolean;
  onEnlarge: (() => void) | undefined;
}

/**
 * In the column next to a screen, someone with the camera on gets a 16:9 rectangle instead
 * of a small round photo; a click enlarges it on the stage, as before.
 */
export function StripCameraTile({
  scope,
  participant,
  camera,
  name,
  label,
  muted,
  deafened,
  isSharing,
  handRaised,
  isSpeaking,
  onEnlarge,
}: StripCameraTileProps) {
  return (
    <div
      key="camera"
      ref={scope}
      data-flip-id={`tile-${participant.identity}`}
      className="relative isolate aspect-video w-40 shrink-0 rounded-2xl lg:w-full"
    >
      <div
        data-glow
        aria-hidden="true"
        className="pointer-events-none absolute -inset-1 -z-10 rounded-[1.15rem] bg-brand/30 opacity-0 blur-md"
      />
      <div className="relative size-full overflow-hidden rounded-2xl border border-tile-line bg-tile shadow-soft">
        <CameraVideo camera={camera} className="absolute inset-0 size-full" />
        {onEnlarge ? (
          <EnlargeButton name={name} rounded="rounded-2xl" onEnlarge={onEnlarge} />
        ) : null}
        <div
          data-ring
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 rounded-2xl opacity-0 ring-3 ring-brand-soft ring-inset"
        />
        <SilencedBadge
          participant={participant}
          name={name}
          className="absolute top-1.5 right-1.5 z-30"
        />
        {handRaised ? (
          <span className="absolute top-1.5 left-1.5 z-30 grid size-6 place-items-center rounded-full bg-warning text-canvas">
            <Hand className="size-3.5" aria-hidden="true" />
            <span className="sr-only">{name} está com a mão levantada</span>
          </span>
        ) : null}
        <div className="pointer-events-none absolute inset-x-1.5 bottom-1.5 z-30 flex items-center justify-between gap-1">
          <span className="glass inline-flex min-w-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium">
            <HostBadge identity={participant.identity} />
            <span className="truncate">{label}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1">
            {isSharing ? (
              <span className="grid size-6 place-items-center rounded-full bg-brand text-brand-ink">
                <MonitorUp className="size-3.5" aria-hidden="true" />
                <span className="sr-only">compartilhando a tela</span>
              </span>
            ) : null}
            <SoundBadge deafened={deafened} muted={muted} variant="small" />
          </span>
        </div>
        {isSpeaking ? <span className="sr-only">{name} está falando</span> : null}
      </div>
    </div>
  );
}
