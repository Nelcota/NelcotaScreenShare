import { useIsMuted, useIsSpeaking, useParticipantAttribute } from "@livekit/components-react";
import { Track, type Participant } from "livekit-client";
import { Hand, Mic, MicOff, MonitorUp } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { Popover as PopoverPrimitive, Dialog as DialogPrimitive } from "radix-ui";
import { HAND_ATTRIBUTE } from "@/features/room/domain/data-channel";
import { isGuestIdentity } from "@/features/room/domain/participant-label";
import { timeInCallLabel } from "@/features/room/domain/time-in-call";
import { useIsMobile } from "@/lib/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { CardFriendButton } from "./CardFriendButton";
import { ListeningControls } from "./CardListening";
import { CardModeration } from "./CardModeration";
import { CardRoles } from "./CardRoles";
import { CardReportButton } from "./CardReportButton";
import { ParticipantAvatar } from "./ParticipantAvatar";
import { RoleBadge } from "./RoleBadge";

interface CardProps {
  participant: Participant;
  roomCode: string;
  isSharing: boolean;
}

/** Dragging the sheet down this far closes it. */
const CLOSE_DRAG = 80;

function plainName(participant: Participant): string {
  return participant.name || participant.identity;
}

function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

function badgeLabel(participant: Participant): string {
  if (participant.isLocal) return "Você";
  if (isGuestIdentity(participant.identity)) return "Convidado";
  return "Conta";
}

function Badge({ participant }: { participant: Participant }) {
  const label = badgeLabel(participant);
  const account = label === "Conta";
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium",
        account ? "bg-brand/15 text-brand-soft" : "bg-surface-3 text-ink-muted",
      )}
    >
      {label}
    </span>
  );
}

function StateChip({ icon, label, tone }: { icon: ReactNode; label: string; tone: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm", tone)}>
      {icon}
      {label}
    </span>
  );
}

function StateChips({ participant, isSharing }: { participant: Participant; isSharing: boolean }) {
  const micMuted = useIsMuted({ participant, source: Track.Source.Microphone });
  const handRaised = useParticipantAttribute(HAND_ATTRIBUTE, { participant }) === "1";
  return (
    <div className="flex flex-wrap justify-center gap-1.5">
      {micMuted ? (
        <StateChip
          icon={<MicOff className="size-4" aria-hidden="true" />}
          label="Microfone desligado"
          tone="bg-danger/12 text-danger"
        />
      ) : (
        <StateChip
          icon={<Mic className="size-4" aria-hidden="true" />}
          label="Microfone ligado"
          tone="bg-surface-3 text-ink-muted"
        />
      )}
      {isSharing ? (
        <StateChip
          icon={<MonitorUp className="size-4" aria-hidden="true" />}
          label="Mostrando a tela"
          tone="bg-info/12 text-info"
        />
      ) : null}
      {handRaised ? (
        <StateChip
          icon={<Hand className="size-4" aria-hidden="true" />}
          label="Mão levantada"
          tone="bg-warning/15 text-warning"
        />
      ) : null}
    </div>
  );
}

function CardBody({
  participant,
  roomCode,
  isSharing,
  title,
  onClose,
}: CardProps & { title: ReactNode; onClose: () => void }) {
  const isSpeaking = useIsSpeaking(participant);
  const now = useNow(30_000);
  const joinedAt = participant.joinedAt;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <ParticipantAvatar
          participant={participant}
          roomCode={roomCode}
          className={cn(
            "size-20 bg-surface-3 text-2xl font-medium text-ink ring-1 ring-line transition-shadow",
            isSpeaking && "ring-3 ring-brand-soft",
          )}
        />
        <div className="flex flex-wrap items-center justify-center gap-2">
          {title}
          <Badge participant={participant} />
          <RoleBadge participant={participant} />
        </div>
        {joinedAt ? (
          <p className="text-sm text-ink-muted">Na chamada {timeInCallLabel(joinedAt, now)}</p>
        ) : null}
      </div>
      <StateChips participant={participant} isSharing={isSharing} />
      {participant.isLocal || isGuestIdentity(participant.identity) ? null : (
        <CardFriendButton userId={participant.identity} />
      )}
      {participant.isLocal ? null : <ListeningControls participant={participant} />}
      <CardRoles participant={participant} roomCode={roomCode} />
      <CardModeration participant={participant} roomCode={roomCode} onRemoved={onClose} />
      {participant.isLocal || isGuestIdentity(participant.identity) ? null : (
        <CardReportButton userId={participant.identity} name={plainName(participant)} />
      )}
    </div>
  );
}

const NAME_CLASS = "text-lg font-semibold tracking-tight";

function CardPopover({ children, ...props }: CardProps & { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>{children}</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side="right"
          align="center"
          sideOffset={12}
          collisionPadding={16}
          aria-label={plainName(props.participant)}
          className="glass z-50 w-80 rounded-2xl p-5 outline-none"
        >
          <CardBody
            {...props}
            onClose={() => setOpen(false)}
            title={<p className={NAME_CLASS}>{plainName(props.participant)}</p>}
          />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

/** Phone: a sheet from the bottom with a handle; dragging it down closes it. */
function CardSheet({ children, ...props }: CardProps & { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [drag, setDrag] = useState(0);
  const start = useRef<number | null>(null);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    start.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (start.current === null) return;
    setDrag(Math.max(0, event.clientY - start.current));
  }
  function onPointerUp() {
    start.current = null;
    if (drag > CLOSE_DRAG) setOpen(false);
    setDrag(0);
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>{children}</DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          style={drag > 0 ? { transform: `translateY(${drag}px)` } : undefined}
          className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-line bg-surface px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] outline-none data-open:animate-in data-open:slide-in-from-bottom-10 data-closed:animate-out data-closed:slide-out-to-bottom-10"
        >
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="flex touch-none justify-center pt-3 pb-4"
          >
            <span aria-hidden="true" className="h-1.5 w-10 rounded-full bg-line-strong" />
          </div>
          <CardBody
            {...props}
            onClose={() => setOpen(false)}
            title={
              <DialogPrimitive.Title className={NAME_CLASS}>
                {plainName(props.participant)}
              </DialogPrimitive.Title>
            }
          />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/**
 * Tapping someone's photo in the call opens their card: who they are, what they are doing
 * and, for the others, a volume only for me.
 */
export function ParticipantCard({
  children,
  className,
  ...props
}: CardProps & { children: ReactNode; className?: string }) {
  const isMobile = useIsMobile();
  const trigger = (
    <button
      type="button"
      aria-label={`Ver ${plainName(props.participant)}`}
      className={cn(
        "rounded-full outline-none focus-visible:ring-3 focus-visible:ring-brand-soft",
        className,
      )}
    >
      {children}
    </button>
  );
  if (isMobile) return <CardSheet {...props}>{trigger}</CardSheet>;
  return <CardPopover {...props}>{trigger}</CardPopover>;
}
