import { useParticipantAttribute } from "@livekit/components-react";
import type { Participant } from "livekit-client";
import { HeadphoneOff, MicOff } from "lucide-react";
import { DEAFENED_ATTRIBUTE } from "@/features/room/domain/data-channel";
import { useDeafen } from "@/features/room/ui/dock/Deafen";
import { cn } from "@/lib/utils";

/**
 * Whether the person stopped hearing the room. Your own shows at once; the others' arrive
 * from the server.
 */
export function useIsDeafened(participant: Participant): boolean {
  const { deafened } = useDeafen();
  const shared = useParticipantAttribute(DEAFENED_ATTRIBUTE, { participant }) === "1";
  return shared || (participant.isLocal && deafened);
}

const SOUND_BADGE_STYLES = {
  compact: {
    badge: "absolute -right-1 -bottom-1 size-6 ring-2 ring-canvas",
    icon: "size-3.5",
  },
  large: { badge: "size-8", icon: "size-4" },
  /** Inside a name chip (the screen card's corner). */
  chip: { badge: "size-6", icon: "size-3.5" },
} as const;

/** Red badge: "Sem som" (headphones) wins over the muted microphone, which it implies. */
export function SoundBadge({
  deafened,
  muted,
  variant,
}: {
  deafened: boolean;
  muted: boolean;
  variant: keyof typeof SOUND_BADGE_STYLES;
}) {
  if (!deafened && !muted) return null;
  const styles = SOUND_BADGE_STYLES[variant];
  const Icon = deafened ? HeadphoneOff : MicOff;
  return (
    <span
      className={cn("grid place-items-center rounded-full bg-danger text-canvas", styles.badge)}
    >
      <Icon className={styles.icon} aria-hidden="true" />
      <span className="sr-only">{deafened ? "sem som" : "microfone desligado"}</span>
    </span>
  );
}
