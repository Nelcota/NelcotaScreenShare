/**
 * Pieces of an ongoing call shown outside the room page: the floating card today, the
 * voice panel at the foot of the app's column later. Same state as the dock.
 */
import {
  useConnectionState,
  useParticipants,
  useRoomContext,
  useLocalParticipant,
} from "@livekit/components-react";
import { ConnectionState, type Participant } from "livekit-client";
import {
  Headphones,
  HeadphoneOff,
  Mic,
  MicOff,
  MonitorOff,
  MonitorUp,
  PhoneOff,
  Undo2,
} from "lucide-react";
import { Popover } from "radix-ui";
import { toast } from "sonner";
import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { Hint } from "@/components/Hint";
import { participantLabel } from "@/features/room/domain/participant-label";
import { roomPath } from "@/features/room/domain/room-code";
import { useDeafen } from "@/features/room/ui/dock/Deafen";
import { LeaveConfirm } from "@/features/room/ui/dock/LeaveMenu";
import { reportBrowserError } from "@/lib/telemetry.client";
import { useMicToggle } from "@/features/room/ui/dock/use-mic-toggle";
import { ParticipantAvatar } from "./ParticipantAvatar";
import { MAX_SPEAKERS } from "@/features/room/domain/recent-speakers";
import { useRecentSpeakers } from "@/features/room/hooks/use-recent-speakers";
import { cn } from "@/lib/utils";

const ICON_BUTTON =
  "grid size-9 shrink-0 place-items-center rounded-xl transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60";
// Every button the same size and filled, so none looks smaller than the others.
const NEUTRAL = "bg-surface-2 text-ink hover:bg-surface-3";
const OFF = "bg-danger/10 text-danger hover:bg-danger/15";

/** One person in the call: photo or initials, the mint ring while they speak, a sign while they share. */
function Face({ participant, speaking }: { participant: Participant; speaking: boolean }) {
  const roomCode = useRoomContext().name;
  const name = participantLabel(participant);
  const sharing = participant.isScreenShareEnabled;
  const status = [speaking ? "falando" : "", sharing ? "compartilhando a tela" : ""]
    .filter(Boolean)
    .join(", ");
  return (
    <li className="relative -ml-1.5 first:ml-0">
      <ParticipantAvatar
        participant={participant}
        roomCode={roomCode}
        className={cn(
          "size-8 border border-line-strong bg-surface-2 text-[0.6875rem] font-semibold text-ink ring-2 transition-shadow",
          speaking ? "ring-brand-soft" : "ring-surface",
        )}
      />
      {sharing ? (
        <span
          aria-hidden="true"
          className="absolute -right-1 -bottom-1 grid size-4 place-items-center rounded-full bg-brand text-brand-ink ring-2 ring-surface"
        >
          <MonitorUp className="size-2.5" />
        </span>
      ) : null}
      <span className="sr-only">{status ? `${name}, ${status}` : name}</span>
    </li>
  );
}

/**
 * Who is talking, as the minimized card shows it: up to three recent speakers (the ring
 * while they speak), the last one when nobody talks, and before anyone has spoken the
 * count of people, or your own face when you are alone.
 */
export function CallSpeakers({ max = MAX_SPEAKERS }: { max?: number }) {
  const participants = useParticipants();
  const { faces, nobodyYet } = useRecentSpeakers();
  const byIdentity = new Map(
    participants.map((participant) => [participant.identity, participant]),
  );
  const alone = participants.length <= 1;
  if (nobodyYet && !alone) {
    return (
      <p className="px-1 text-sm font-medium whitespace-nowrap text-ink-muted">
        {participants.length} pessoas
      </p>
    );
  }
  const shown = nobodyYet
    ? participants.slice(0, 1).map((participant) => ({ participant, speaking: false }))
    : faces.slice(0, max).flatMap(({ identity, speaking }) => {
        const participant = byIdentity.get(identity);
        return participant ? [{ participant, speaking }] : [];
      });
  return (
    <ul aria-label="Na chamada" className="flex items-center pl-1">
      {shown.map(({ participant, speaking }) => (
        <Face key={participant.identity} participant={participant} speaking={speaking} />
      ))}
    </ul>
  );
}

function IconButton({
  label,
  pressed,
  off,
  disabled,
  onPress,
  children,
}: {
  label: string;
  pressed: boolean;
  off: boolean;
  disabled: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Hint text={label}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={pressed}
        disabled={disabled}
        onClick={onPress}
        className={cn(ICON_BUTTON, off ? OFF : NEUTRAL)}
      >
        {children}
      </button>
    </Hint>
  );
}

export function CallMicButton() {
  const mic = useMicToggle();
  return (
    <IconButton
      label={mic.enabled ? "Desligar microfone" : "Ligar microfone"}
      pressed={!mic.enabled}
      off={!mic.enabled}
      disabled={mic.busy}
      onPress={() => void mic.toggle()}
    >
      {mic.enabled ? (
        <Mic className="size-4" aria-hidden="true" />
      ) : (
        <MicOff className="size-4" aria-hidden="true" />
      )}
    </IconButton>
  );
}

/** Same state as the dock's headphones. */
export function CallDeafenButton() {
  const { deafened, toggle } = useDeafen();
  const [busy, setBusy] = useState(false);

  async function handleToggle() {
    setBusy(true);
    await toggle();
    setBusy(false);
  }

  return (
    <IconButton
      label={deafened ? "Voltar a ouvir a sala" : "Parar de ouvir a sala"}
      pressed={deafened}
      off={deafened}
      disabled={busy}
      onPress={() => void handleToggle()}
    >
      {deafened ? (
        <HeadphoneOff className="size-4" aria-hidden="true" />
      ) : (
        <Headphones className="size-4" aria-hidden="true" />
      )}
    </IconButton>
  );
}

/** Green while connected, amber and pulsing while it reconnects. */
export function CallConnectionDot({ className }: { className?: string }) {
  const connected = useConnectionState() === ConnectionState.Connected;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "size-2 shrink-0 rounded-full",
        connected ? "live-dot bg-success" : "animate-pulse bg-warning",
        className,
      )}
    />
  );
}

export function BackToRoomLink({ code }: { code: string }) {
  return (
    <Hint text="Voltar à chamada">
      <Link
        viewTransition
        to={roomPath(code)}
        aria-label="Voltar à chamada"
        className={cn(ICON_BUTTON, NEUTRAL)}
      >
        <Undo2 className="size-4" aria-hidden="true" />
      </Link>
    </Hint>
  );
}

/** Only while you share: stops it without going back to the room. */
export function CallStopShareButton() {
  const { localParticipant, isScreenShareEnabled } = useLocalParticipant();
  const [busy, setBusy] = useState(false);
  if (!isScreenShareEnabled) return null;

  async function stop() {
    setBusy(true);
    try {
      await localParticipant.setScreenShareEnabled(false);
    } catch (error) {
      reportBrowserError(error);
      toast.error("Não foi possível parar o compartilhamento. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <IconButton
      label="Parar de compartilhar"
      pressed={false}
      off={false}
      disabled={busy}
      onPress={() => void stop()}
    >
      <MonitorOff className="size-4" aria-hidden="true" />
    </IconButton>
  );
}

/** Leaving the call asks first, as in the dock. */
export function CallLeaveButton({ onLeave }: { onLeave: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Hint text="Sair da sala">
        <Popover.Trigger asChild>
          <button
            type="button"
            aria-label="Sair da sala"
            aria-haspopup="dialog"
            className={cn(ICON_BUTTON, "bg-danger text-canvas hover:bg-danger/90")}
          >
            <PhoneOff className="size-4" aria-hidden="true" />
          </button>
        </Popover.Trigger>
      </Hint>
      <LeaveConfirm
        align="end"
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false);
          onLeave();
        }}
      />
    </Popover.Root>
  );
}
