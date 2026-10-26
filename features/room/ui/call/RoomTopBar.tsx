import type { RoomTitle } from "@/features/room/domain/room-title";
import type { Participant } from "livekit-client";
import { useId } from "react";
import { Switch } from "@/components/ui/switch";
import { useParticipantName } from "@/features/room/hooks/use-participant-name";
import { useStreamerMode } from "@/features/room/hooks/use-streamer-mode";
import { Check, Copy, Ellipsis, LayoutDashboard } from "lucide-react";
import { Link, useRouteLoaderData } from "react-router";
import type { loader as rootLoader } from "@/app/root";
import { Hint } from "@/components/Hint";
import { NavBar, NavBrand, NavDivider, NavPopover } from "@/components/shell/NavBar";
import { navItemClass } from "@/components/shell/nav-item-class";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { useCopyRoomLink } from "@/features/room/hooks/use-copy-room-link";
import { useRoomName } from "@/features/room/hooks/use-room-roles";
import { cn } from "@/lib/utils";
import { NameEditor } from "./NameEditor";
import { ParticipantAvatar } from "./ParticipantAvatar";
import { ShortcutsHelp } from "./ShortcutsHelp";
import { RoleBadge } from "./RoleBadge";
import { RoomAccessChip } from "./RoomAccessChip";
import { HostBadge } from "./HostBadge";
import { HostParticipantMenu } from "./HostParticipantMenu";
import { ParticipantAudioMenu } from "./ParticipantAudioMenu";
import { HostControlsMenu } from "./HostControlsMenu";
import { startPath } from "@/features/room/domain/start-path";
import type { Connection } from "./RoomLayout";

const CONNECTION_LABELS: Record<Connection, string> = {
  connected: "Conectado",
  connecting: "Conectando",
  reconnecting: "Reconectando",
};

/** Someone's name in the list, kept current when they rename themselves. */
function PersonName({ participant }: { participant: Participant }) {
  const { name } = useParticipantName(participant);
  return (
    <span className="block truncate">
      {name}
      {participant.isLocal ? <span className="text-ink-muted"> (você)</span> : null}
    </span>
  );
}

/**
 * "Sala de Ana · abc-defg-hij" that copies the link; the confirmation appears on the button
 * itself. In streamer mode only the name shows; a room without an owner shows the code.
 */
function RoomCodeButton({ code, name }: { code: string; name: string | null }) {
  const { copied, copy } = useCopyRoomLink(code);
  const { enabled } = useStreamerMode();

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={
        enabled
          ? `${name ?? "Código oculto"}. Copiar link para convidar`
          : `${name ?? "Sala"} ${code}. Copiar link para convidar`
      }
      className="group flex h-10 min-w-0 items-center gap-2 rounded-xl px-3 transition-colors hover:bg-surface-3"
    >
      <RoomLabel code={code} name={name} hideCode={enabled} />
      {copied ? (
        <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-success">
          <Check className="size-4" aria-hidden="true" />
          <span className="max-sm:sr-only">Copiado</span>
        </span>
      ) : (
        <Copy
          className="size-4 shrink-0 text-ink-muted transition-colors group-hover:text-ink"
          aria-hidden="true"
        />
      )}
    </button>
  );
}

/** The room's name, the code next to it, or only the name when the code must stay hidden. */
function RoomLabel({
  code,
  name,
  hideCode,
}: {
  code: string;
  name: string | null;
  hideCode: boolean;
}) {
  if (name && hideCode) {
    return <span className="truncate text-base font-medium tracking-tight">{name}</span>;
  }
  if (name) {
    return (
      <span className="truncate text-base font-medium tracking-tight">
        {name}
        <span className="font-sans font-normal text-ink-muted tabular-nums max-sm:hidden">
          {" "}
          · {code}
        </span>
      </span>
    );
  }
  return (
    <span className="truncate text-base font-medium tracking-tight">
      <span className="font-normal text-ink-muted max-sm:hidden">Sala </span>
      <span className="font-sans tabular-nums">{hideCode ? "Código oculto" : code}</span>
    </span>
  );
}

/** Stacked avatars + "N pessoas"; on tap, the list and the room limit. */
function PeopleButton({
  participants,
  max,
  roomCode,
}: {
  participants: Participant[];
  max: number;
  roomCode: string;
}) {
  const shown = participants.slice(0, 3);
  const count = participants.length;
  return (
    <NavPopover
      label="Pessoas na sala"
      align="end"
      trigger={
        <>
          <span className="flex -space-x-2" aria-hidden="true">
            {shown.map((participant) => (
              <ParticipantAvatar
                key={participant.identity}
                participant={participant}
                roomCode={roomCode}
                // Opaque, the same tint over the surface: the faces overlap, and a see-through
                // fill would show the photo underneath inside the initials.
                className="size-8 bg-[color-mix(in_oklab,var(--color-brand)_20%,var(--color-surface))] text-sm font-medium text-brand-soft ring-2 ring-surface"
              />
            ))}
          </span>
          <span className="text-sm font-medium text-ink">
            {count === 1 ? "1 pessoa" : `${count} pessoas`}
          </span>
        </>
      }
    >
      <p className="text-base font-medium tracking-tight">Na sala agora</p>
      <ul className="mt-3 flex flex-col gap-2.5">
        {participants.map((participant) => (
          <li key={participant.identity} className="flex items-center gap-3 text-base">
            <ParticipantAvatar
              participant={participant}
              roomCode={roomCode}
              className="size-9 shrink-0 bg-brand/20 text-sm font-medium text-brand-soft"
            />
            {/* The roles go under the name: beside it, they cut a long name short. */}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <PersonName participant={participant} />
              <div className="flex flex-wrap gap-1 empty:hidden">
                <RoleBadge participant={participant} />
                <HostBadge identity={participant.identity} />
              </div>
            </div>
            <ParticipantAudioMenu participant={participant} />
            <HostParticipantMenu participant={participant} />
          </li>
        ))}
      </ul>
      <p className="mt-4 border-t border-line pt-3 text-sm text-ink-muted">
        Cabem até {max} pessoas nesta sala.
      </p>
    </NavPopover>
  );
}

/** Room link, connection state, participants, your name, shortcuts help and theme. */
export function RoomTopBar({
  code,
  participants,
  maxParticipants,
  roomName,
  isAdmin,
  connection,
}: {
  code: string;
  participants: Participant[];
  maxParticipants: number;
  /** The name as the page loaded it; "Sala de Ana" follows a new owner live. */
  roomName: RoomTitle | null;
  /** Admins open the panel without leaving: the call goes on minimized. */
  isAdmin: boolean;
  connection: Connection;
}) {
  const streamer = useStreamerMode();
  const streamerId = useId();
  const name = useRoomName(participants, roomName);
  // The way back to the start, like everywhere else; the call goes on minimized. From the
  // page's account, not the call's identity: that one is empty until the call connects.
  const signedIn = useRouteLoaderData<typeof rootLoader>("root")?.account != null;
  const startHref = startPath(signedIn);
  return (
    <NavBar aria-label="Sala" className="mx-auto max-w-5xl">
      <NavBrand href={startHref} showName={false} className="max-sm:hidden" />
      <NavDivider className="max-sm:hidden" />
      <RoomCodeButton code={code} name={name} />
      <RoomAccessChip code={code} />
      {/* Just a dot: green when connected, pulsing yellow while (re)connecting (the
          written notice appears in the middle of the screen). */}
      <span className="flex shrink-0 items-center">
        <span
          aria-hidden="true"
          className={cn(
            "size-2.5 rounded-full",
            connection === "connected" ? "live-dot bg-success" : "animate-pulse bg-warning",
          )}
        />
        <span className="sr-only">{CONNECTION_LABELS[connection]}</span>
      </span>

      <span className="ml-auto" />
      <PeopleButton participants={participants} max={maxParticipants} roomCode={code} />
      <HostControlsMenu participants={participants} />
      {isAdmin ? (
        <Hint text="Painel admin (a chamada continua)">
          <Link
            viewTransition
            to="/admin"
            aria-label="Abrir o painel admin"
            className={navItemClass}
          >
            <LayoutDashboard className="size-5" aria-hidden="true" />
          </Link>
        </Hint>
      ) : null}
      <ShortcutsHelp className="max-sm:hidden" />
      <ThemeToggle className="max-sm:hidden" />
      <NavPopover
        label="Mais opções"
        iconOnly
        align="end"
        trigger={<Ellipsis className="size-5" aria-hidden="true" />}
      >
        <div className="mb-4 border-b border-line pb-4">
          <label htmlFor={streamerId} className="flex items-center justify-between gap-3">
            <span className="text-base font-medium">Modo streamer</span>
            <Switch
              id={streamerId}
              checked={streamer.enabled}
              onCheckedChange={streamer.setEnabled}
            />
          </label>
          <p className="mt-2 text-sm text-ink-muted">
            Esconde o código, o link e o QR code da sala, inclusive na barra de endereço.
          </p>
        </div>
        <div className="max-sm:mb-4 max-sm:border-b max-sm:border-line max-sm:pb-4">
          <NameEditor code={code} />
        </div>
        <div className="flex items-center justify-between gap-3 sm:hidden">
          <span className="text-base font-medium">Tema claro ou escuro</span>
          <ThemeToggle />
        </div>
      </NavPopover>
    </NavBar>
  );
}
