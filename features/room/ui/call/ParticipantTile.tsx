import { useIsMuted, useIsSpeaking, useParticipantAttribute } from "@livekit/components-react";
import { Track, type Participant } from "livekit-client";
import { Hand, MicOff, MonitorUp } from "lucide-react";
import { HAND_ATTRIBUTE } from "@/features/room/domain/data-channel";
import { useRef, type RefObject } from "react";
import { gsap, prefersReducedMotion, useGSAP } from "@/lib/animation/gsap";
import { participantLabel, participantName } from "@/features/room/domain/participant-label";
import { initials } from "@/lib/initials";
import { ParticipantAudioMenu } from "./ParticipantAudioMenu";
import { HostBadge } from "./HostBadge";

interface ParticipantTileProps {
  participant: Participant;
  isSharing: boolean;
  compact: boolean;
}

/** Soft pulse on the border of whoever is speaking. */
function useSpeakingPulse(
  scope: RefObject<HTMLDivElement | null>,
  isSpeaking: boolean,
  compact: boolean,
) {
  const pulse = useRef<gsap.core.Tween | null>(null);
  useGSAP(
    () => {
      pulse.current?.kill();
      pulse.current = null;
      const reduced = prefersReducedMotion();

      if (!isSpeaking) {
        gsap.to(["[data-ring]", "[data-glow]"], {
          opacity: 0,
          scale: 1,
          duration: reduced ? 0 : 0.4,
          overwrite: "auto",
        });
        return;
      }
      gsap.to("[data-ring]", { opacity: 1, duration: reduced ? 0 : 0.2, overwrite: "auto" });
      if (reduced) return;
      pulse.current = gsap.fromTo(
        "[data-glow]",
        { opacity: 0.35, scale: 1 },
        {
          opacity: 0.8,
          scale: 1.03,
          duration: 0.75,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
        },
      );
    },
    { scope, dependencies: [isSpeaking, compact] },
  );
}

export function ParticipantTile({ participant, isSharing, compact }: ParticipantTileProps) {
  const scope = useRef<HTMLDivElement>(null);
  const isSpeaking = useIsSpeaking(participant);
  const isMuted = useIsMuted({ participant, source: Track.Source.Microphone });
  const name = participantName(participant);
  const handRaised = useParticipantAttribute(HAND_ATTRIBUTE, { participant }) === "1";
  useSpeakingPulse(scope, isSpeaking, compact);

  if (compact) {
    // Stage in use: round avatar with the name below (FaceTime style).
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
          <div
            aria-hidden="true"
            className="grid size-14 place-items-center rounded-full bg-surface-3 text-lg font-medium text-ink ring-1 ring-line"
          >
            {initials(name)}
          </div>
          <div
            data-ring
            aria-hidden="true"
            className="pointer-events-none absolute -inset-0.5 rounded-full opacity-0 ring-3 ring-brand-soft"
          />
          {isMuted ? (
            <span className="absolute -right-1 -bottom-1 grid size-6 place-items-center rounded-full bg-danger text-canvas ring-2 ring-canvas">
              <MicOff className="size-3.5" aria-hidden="true" />
              <span className="sr-only">microfone desligado</span>
            </span>
          ) : null}
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
          <ParticipantAudioMenu participant={participant} className="absolute -bottom-1 -left-1" />
        </div>
        <span className="w-full truncate text-center text-sm font-medium lg:text-left lg:text-base">
          {participantLabel(participant)}
          <HostBadge identity={participant.identity} />
        </span>
        {isSpeaking ? <span className="sr-only">{name} está falando</span> : null}
      </div>
    );
  }

  return (
    <div
      key="tile"
      ref={scope}
      data-flip-id={`tile-${participant.identity}`}
      className="relative isolate aspect-video w-full shrink-0 rounded-3xl"
    >
      {/* Glow and ring for whoever is speaking. */}
      <div
        data-glow
        aria-hidden="true"
        className="pointer-events-none absolute -inset-1 -z-10 rounded-[1.65rem] bg-brand/30 opacity-0 blur-md"
      />
      <div className="relative flex size-full flex-col items-center justify-center overflow-hidden rounded-3xl border border-line bg-surface shadow-soft">
        <ParticipantAudioMenu participant={participant} className="absolute top-3 right-3" />
        {handRaised ? (
          <span className="absolute top-3 left-3 z-10 inline-flex items-center gap-2 rounded-full bg-warning/15 px-3 py-2 text-sm font-semibold text-warning">
            <Hand className="size-5" aria-hidden="true" />
            <span aria-hidden="true">Mão levantada</span>
            <span className="sr-only">{name} está com a mão levantada</span>
          </span>
        ) : null}
        <div
          data-ring
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-3xl opacity-0 ring-3 ring-brand-soft ring-inset"
        />
        <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,rgb(255_255_255/0.04),transparent)]" />

        <div
          className="grid size-20 place-items-center rounded-full bg-surface-3 text-2xl font-medium text-ink ring-1 ring-line sm:size-24 sm:text-3xl"
          aria-hidden="true"
        >
          {initials(name)}
        </div>

        <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2">
          <span className="glass inline-flex min-w-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium">
            <HostBadge identity={participant.identity} />
            <span className="truncate">
              {name}
              {participant.isLocal ? (
                <span className="font-normal text-ink-muted"> (você)</span>
              ) : null}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            {isSharing ? (
              <span className="grid size-8 place-items-center rounded-full bg-brand text-brand-ink">
                <MonitorUp className="size-4" aria-hidden="true" />
                <span className="sr-only">compartilhando a tela</span>
              </span>
            ) : null}
            {isMuted ? (
              <span className="grid size-8 place-items-center rounded-full bg-danger text-canvas">
                <MicOff className="size-4" aria-hidden="true" />
                <span className="sr-only">microfone desligado</span>
              </span>
            ) : null}
          </span>
        </div>
        {isSpeaking ? <span className="sr-only">{name} está falando</span> : null}
      </div>
    </div>
  );
}
