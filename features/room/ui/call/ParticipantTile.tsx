import {
  useIsMuted,
  useIsSpeaking,
  useParticipantAttribute,
  useParticipantTracks,
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
import { SoundBadge, useIsDeafened } from "./SoundBadge";
import { ShareTileCard } from "./ShareTileCard";
import { ProfileHint, TILE_SURFACE } from "./tile-surface";
import { TileNamePill } from "./TileNamePill";
import { CameraVideo, EnlargeButton } from "./camera-face";
import { StripAvatarTile } from "./StripAvatarTile";
import { StripCameraTile } from "./StripCameraTile";

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

const FACE_STYLES = {
  compact: {
    video: "size-14 rounded-full ring-1 ring-line",
    // The app's mint, in both themes: not white on a white tile.
    avatar: "size-14 bg-brand/15 text-lg font-medium text-brand-soft ring-1 ring-brand/20",
    rounded: "rounded-full",
  },
  large: {
    video: "absolute inset-0 size-full",
    // Grows with the card (its height, `cqh`), from a small card to a full-width one.
    avatar:
      "size-[clamp(4.5rem,26cqh,9rem)] bg-brand/15 text-[clamp(1.5rem,8cqh,3rem)] font-medium text-brand-soft ring-1 ring-brand/20",
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

  if (compact && camera) {
    return (
      <StripCameraTile
        scope={scope}
        participant={participant}
        camera={camera}
        name={name}
        label={label}
        muted={isMuted}
        deafened={isDeafened}
        isSharing={isSharing}
        handRaised={handRaised}
        isSpeaking={isSpeaking}
        onEnlarge={onEnlarge}
      />
    );
  }

  if (compact) {
    // Stage in use: round avatar with the name below (FaceTime style).
    return (
      <StripAvatarTile
        scope={scope}
        participant={participant}
        name={name}
        label={label}
        muted={isMuted}
        deafened={isDeafened}
        isSharing={isSharing}
        handRaised={handRaised}
        isSpeaking={isSpeaking}
        face={
          <PersonFace
            participant={participant}
            name={name}
            roomCode={roomCode}
            camera={camera}
            variant="compact"
            onEnlarge={onEnlarge}
          />
        }
      />
    );
  }

  return (
    <div
      key="tile"
      ref={scope}
      data-flip-id={`tile-${participant.identity}`}
      className="group/tile relative isolate aspect-video w-full shrink-0 rounded-3xl"
    >
      {/* Glow and ring for whoever is speaking. */}
      <div
        data-glow
        aria-hidden="true"
        className="pointer-events-none absolute -inset-1 -z-10 rounded-[1.65rem] bg-brand/30 opacity-0 blur-md"
      />
      <div className={cn(TILE_SURFACE, "[container-type:size]")}>
        <ParticipantAudioMenu participant={participant} className="absolute top-3 right-3" />
        {handRaised ? (
          <span className="absolute top-3 left-3 z-10 inline-flex items-center gap-2 rounded-full bg-warning/15 px-3 py-2 text-sm font-semibold text-warning">
            <Hand className="size-5" aria-hidden="true" />
            <span aria-hidden="true">Mão levantada</span>
            <span className="sr-only">{name} está com a mão levantada</span>
          </span>
        ) : (
          <ProfileHint participant={participant} roomCode={roomCode} />
        )}
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
