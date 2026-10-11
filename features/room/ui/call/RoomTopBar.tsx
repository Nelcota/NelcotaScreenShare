import type { Participant } from "livekit-client";
import { Check, Copy, LayoutDashboard, MoreHorizontal } from "lucide-react";
import { Link, useRouteLoaderData } from "react-router";
import type { loader as rootLoader } from "@/app/root";
import { UserAvatar } from "@/components/UserAvatar";
import { Hint } from "@/components/Hint";
import {
  NavBar,
  NavBrand,
  NavDivider,
  NavPopover,
  ShortcutsPanel,
} from "@/components/shell/NavBar";
import { navItemClass } from "@/components/shell/nav-item-class";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { useCopyRoomLink } from "@/features/room/hooks/use-copy-room-link";
import { participantName } from "@/features/room/domain/participant-label";
import { initials } from "@/lib/initials";
import { cn } from "@/lib/utils";
import type { Connection } from "./RoomLayout";

const CONNECTION_LABELS: Record<Connection, string> = {
  connected: "Conectado",
  connecting: "Conectando",
  reconnecting: "Reconectando",
};

/** "Sala abc-defg-hij" that copies the link; the confirmation appears on the button itself. */
function RoomCodeButton({ code }: { code: string }) {
  const { copied, copy } = useCopyRoomLink(code);

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={`Sala ${code}. Copiar link para convidar`}
      className="group flex h-10 min-w-0 items-center gap-2 rounded-xl px-3 transition-colors hover:bg-surface-3"
    >
      <span className="truncate text-base font-medium tracking-tight">
        <span className="font-normal text-ink-muted max-sm:hidden">Sala </span>
        <span className="font-sans tabular-nums">{code}</span>
      </span>
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

/** Stacked avatars + "N pessoas"; on tap, the list and the room limit. */
function PeopleButton({ participants, max }: { participants: Participant[]; max: number }) {
  const account = useRouteLoaderData<typeof rootLoader>("root")?.account;
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
              <span
                key={participant.identity}
                className="grid size-8 place-items-center rounded-full bg-brand/20 text-sm font-medium text-brand-soft ring-2 ring-surface"
              >
                {participant.isLocal && account?.image ? (
                  <UserAvatar image={account.image} className="size-8" />
                ) : (
                  initials(participantName(participant))
                )}
              </span>
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
            <span
              aria-hidden="true"
              className="grid size-9 shrink-0 place-items-center rounded-full bg-brand/20 text-sm font-medium text-brand-soft"
            >
              {participant.isLocal && account?.image ? (
                <UserAvatar image={account.image} className="size-9" />
              ) : (
                initials(participantName(participant))
              )}
            </span>
            <span className="truncate">
              {participantName(participant)}
              {participant.isLocal ? <span className="text-ink-muted"> (você)</span> : null}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 border-t border-line pt-3 text-sm text-ink-muted">
        Cabem até {max} pessoas nesta sala.
      </p>
    </NavPopover>
  );
}

/** Room link, connection state, participants, shortcuts and theme. */
export function RoomTopBar({
  code,
  participants,
  maxParticipants,
  isAdmin,
  connection,
}: {
  code: string;
  participants: Participant[];
  maxParticipants: number;
  /** Admins open the panel without leaving: the call goes on minimized. */
  isAdmin: boolean;
  connection: Connection;
}) {
  return (
    <NavBar aria-label="Sala" className="mx-auto max-w-5xl">
      <NavBrand showName={false} className="max-sm:hidden" />
      <NavDivider className="max-sm:hidden" />
      <RoomCodeButton code={code} />
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
      <PeopleButton participants={participants} max={maxParticipants} />
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
      <ThemeToggle className="max-sm:hidden" />
      <NavPopover
        label="Mais opções"
        iconOnly
        align="end"
        trigger={<MoreHorizontal className="size-5" aria-hidden="true" />}
      >
        <div className="flex items-center justify-between gap-3 sm:hidden">
          <span className="text-base font-medium">Tema claro ou escuro</span>
          <ThemeToggle />
        </div>
        <div className="max-sm:hidden">
          <ShortcutsPanel />
        </div>
      </NavPopover>
    </NavBar>
  );
}
