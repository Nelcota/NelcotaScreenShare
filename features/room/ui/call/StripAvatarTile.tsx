import type { Participant } from "livekit-client";
import { Hand, MonitorUp } from "lucide-react";
import type { ReactNode, RefObject } from "react";
import { HostBadge } from "./HostBadge";
import { SilencedBadge } from "./SilencedBadge";
import { SoundBadge } from "./SoundBadge";

interface StripAvatarTileProps {
  scope: RefObject<HTMLDivElement | null>;
  participant: Participant;
  name: string;
  label: string;
  muted: boolean;
  deafened: boolean;
  isSharing: boolean;
  handRaised: boolean;
  isSpeaking: boolean;
  /** The round photo (or camera) the person's badges sit around. */
  face: ReactNode;
}

/** With a screen on stage: round photo with the name beside it (FaceTime style). */
export function StripAvatarTile({
  scope,
  participant,
  name,
  label,
  muted,
  deafened,
  isSharing,
  handRaised,
  isSpeaking,
  face,
}: StripAvatarTileProps) {
  return (
    // key per variant: without it React reuses the divs from the large block and the
    // avatar inherits styles GSAP left on them (the glow with opacity 0).
    <div
      key="avatar"
      ref={scope}
      data-flip-id={`tile-${participant.identity}`}
      className="flex w-20 shrink-0 flex-col items-center gap-2 lg:w-full lg:flex-row lg:gap-3"
    >
      <div className="relative isolate shrink-0">
        <div
          data-glow
          aria-hidden="true"
          className="pointer-events-none absolute -inset-1.5 -z-10 rounded-full bg-brand/40 opacity-0 blur-md"
        />
        {face}
        <div
          data-ring
          aria-hidden="true"
          className="pointer-events-none absolute -inset-0.5 rounded-full opacity-0 ring-3 ring-brand-soft"
        />
        <SoundBadge deafened={deafened} muted={muted} variant="compact" />
        {isSharing ? (
          <span className="absolute -top-1 -right-1 grid size-6 place-items-center rounded-full bg-brand text-brand-ink ring-2 ring-canvas">
            <MonitorUp className="size-3.5" aria-hidden="true" />
            <span className="sr-only">compartilhando a tela</span>
          </span>
        ) : null}
        {handRaised ? (
          <span className="absolute -top-1 -left-1 grid size-6 place-items-center rounded-full bg-warning text-canvas ring-2 ring-canvas">
            <Hand className="size-3.5" aria-hidden="true" />
            <span className="sr-only">{name} está com a mão levantada</span>
          </span>
        ) : null}
        <SilencedBadge
          participant={participant}
          name={name}
          className="absolute -bottom-1 -left-1 ring-2 ring-canvas"
        />
      </div>
      <span className="w-full truncate text-center text-sm font-medium lg:text-left lg:text-base">
        {label}
        <HostBadge identity={participant.identity} />
      </span>
      {isSpeaking ? <span className="sr-only">{name} está falando</span> : null}
    </div>
  );
}
