import {
  useIsMuted,
  useIsSpeaking,
  useParticipantAttribute,
  useParticipantTracks,
  VideoTrack,
  type TrackReference,
} from "@livekit/components-react";
import { Track, type Participant } from "livekit-client";
import { Hand, MonitorUp } from "lucide-react";
import { HAND_ATTRIBUTE } from "@/features/room/domain/data-channel";
import { useRef, type RefObject } from "react";
import { gsap, prefersReducedMotion, useGSAP } from "@/lib/animation/gsap";
import { useParticipantName } from "@/features/room/hooks/use-participant-name";
import { ParticipantAvatar } from "./ParticipantAvatar";
import { ParticipantAudioMenu } from "./ParticipantAudioMenu";
import { ParticipantCard } from "./ParticipantCard";
import { SwitchCameraButton } from "./SwitchCameraButton";
import { cn } from "@/lib/utils";
import { HostBadge } from "./HostBadge";
import { SoundBadge, useIsDeafened } from "./SoundBadge";
import { ShareTileCard } from "./ShareTileCard";
import { TileNamePill } from "./TileNamePill";

interface ParticipantTileProps {
  participant: Participant;
  roomCode: string;
  isSharing: boolean;
  compact: boolean;
  /** Enlarges this person's camera on the stage (only while it is on). */
  onEnlarge?: () => void;
  /** Their screen, shared and not watched here yet: the tile becomes its "Assistir" card. */
  screenInvite?: string;
  /** Your own tile while someone else presents: on a phone it is small, so "Você" and a
   * smaller face. */
  shrunkOnPhone?: boolean;
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

/** The person's camera while it is on and arriving; none means their initials show. */
function useCamera(participant: Participant): TrackReference | undefined {
  const camera = useParticipantTracks([Track.Source.Camera], participant.identity)[0];
  const muted = useIsMuted({ participant, source: Track.Source.Camera });
  if (!camera?.publication.track || muted) return undefined;
  return camera;
}

/** Your own camera shows mirrored, as in a mirror; everyone else sees it the right way round. */
function CameraVideo({ camera, className }: { camera: TrackReference; className: string }) {
  return (
    <VideoTrack
      trackRef={camera}
      aria-hidden="true"
      className={cn(className, "object-cover", camera.participant.isLocal && "-scale-x-100")}
    />
  );
}

/** Over a camera: clicking the person's card enlarges it on the stage. */
function EnlargeButton({
  name,
  rounded,
  onEnlarge,
}: {
  name: string;
  rounded: string;
  onEnlarge: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={`Ampliar a câmera de ${name}`}
      onClick={onEnlarge}
      className={cn(
        "absolute inset-0 z-20 cursor-zoom-in focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        rounded,
      )}
    />
  );
}

const FACE_STYLES = {
  compact: {
    video: "size-14 rounded-full ring-1 ring-line",
    // The app's mint, in both themes: not white on a white tile.
    avatar: "size-14 bg-brand/15 text-lg font-medium text-brand-soft ring-1 ring-brand/20",
    rounded: "rounded-full",
  },
  large: {
    video: "absolute inset-0 size-full",
    avatar:
      "size-20 bg-brand/15 text-2xl font-medium text-brand-soft ring-1 ring-brand/20 sm:size-24 sm:text-3xl",
    rounded: "rounded-3xl",
  },
} as const;

/**
 * The camera when it is on, which can be enlarged; otherwise the photo, which opens the
 * person's card.
 */
function PersonFace({
  participant,
  name,
  roomCode,
  camera,
  variant,
  onEnlarge,
  avatarClassName,
}: {
  participant: Participant;
  name: string;
  roomCode: string;
  camera: TrackReference | undefined;
  variant: keyof typeof FACE_STYLES;
  onEnlarge: (() => void) | undefined;
  avatarClassName?: string;
}) {
  const styles = FACE_STYLES[variant];
  if (!camera) {
    return (
      <ParticipantCard participant={participant} roomCode={roomCode}>
        <ParticipantAvatar
          participant={participant}
          roomCode={roomCode}
          className={cn(styles.avatar, avatarClassName)}
        />
      </ParticipantCard>
    );
  }
  return (
    <>
      <CameraVideo camera={camera} className={styles.video} />
      {onEnlarge ? (
        <EnlargeButton name={name} rounded={styles.rounded} onEnlarge={onEnlarge} />
      ) : null}
    </>
  );
}

export function ParticipantTile({
  participant,
  roomCode,
  isSharing,
  compact,
  onEnlarge,
  screenInvite,
  shrunkOnPhone = false,
}: ParticipantTileProps) {
  const scope = useRef<HTMLDivElement>(null);
  const isSpeaking = useIsSpeaking(participant);
  const isMuted = useIsMuted({ participant, source: Track.Source.Microphone });
  const isDeafened = useIsDeafened(participant);
  const { name, label } = useParticipantName(participant);
  const handRaised = useParticipantAttribute(HAND_ATTRIBUTE, { participant }) === "1";
  const camera = useCamera(participant);
  useSpeakingPulse(scope, isSpeaking, compact);
  const share = { participant, roomCode, name, muted: isMuted, deafened: isDeafened, isSpeaking };
  if (screenInvite && !compact)
    return <ShareTileCard scope={scope} trackSid={screenInvite} {...share} />;

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
          <PersonFace
            participant={participant}
            name={name}
            roomCode={roomCode}
            camera={camera}
            variant="compact"
            onEnlarge={onEnlarge}
          />
          <div
            data-ring
            aria-hidden="true"
            className="pointer-events-none absolute -inset-0.5 rounded-full opacity-0 ring-3 ring-brand-soft"
          />
          <SoundBadge deafened={isDeafened} muted={isMuted} variant="compact" />
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
          {label}
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
      <div className="relative flex size-full flex-col items-center justify-center overflow-hidden rounded-3xl border border-tile-line bg-tile shadow-soft">
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
          className="pointer-events-none absolute inset-0 z-10 rounded-3xl opacity-0 ring-3 ring-brand-soft ring-inset"
        />
        <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,rgb(255_255_255/0.04),transparent)]" />

        <PersonFace
          participant={participant}
          name={name}
          roomCode={roomCode}
          camera={camera}
          variant="large"
          onEnlarge={onEnlarge}
          avatarClassName={shrunkOnPhone ? "max-sm:size-12 max-sm:text-base" : undefined}
        />
        {camera && participant.isLocal ? <SwitchCameraButton /> : null}

        <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2">
          <TileNamePill
            participant={participant}
            roomCode={roomCode}
            withPhoto={camera !== undefined}
            shrunkOnPhone={shrunkOnPhone}
          />
          <span className="flex shrink-0 items-center gap-1.5">
            {isSharing ? (
              <span className="grid size-8 place-items-center rounded-full bg-brand text-brand-ink">
                <MonitorUp className="size-4" aria-hidden="true" />
                <span className="sr-only">compartilhando a tela</span>
              </span>
            ) : null}
            <SoundBadge deafened={isDeafened} muted={isMuted} variant="large" />
          </span>
        </div>
        {isSpeaking ? <span className="sr-only">{name} está falando</span> : null}
      </div>
    </div>
  );
}
