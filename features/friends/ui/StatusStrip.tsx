import { ChevronUp, Settings } from "lucide-react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Hint } from "@/components/Hint";
import { UserAvatar } from "@/components/UserAvatar";
import { navItemClass } from "@/components/shell/nav-item-class";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setPresenceStatus } from "@/features/friends/actions";
import {
  OWN_STATUS_LABEL,
  PRESENCE_STATUSES,
  STATUS_CHOICES,
  type PresenceStatus,
  type ShownStatus,
} from "@/features/friends/domain/presence-status";
import { STATUS_DOT } from "@/features/friends/ui/FriendAvatar";
import { useOperation } from "@/lib/operations/use-operation";
import { cn } from "@/lib/utils";

/** Invisible shows you the empty ring, as your friends see you. */
const OWN_DOT: Record<PresenceStatus, ShownStatus> = {
  online: "online",
  away: "away",
  busy: "busy",
  invisible: "offline",
};

function isStatus(value: string): value is PresenceStatus {
  return PRESENCE_STATUSES.some((status) => status === value);
}

function Dot({ status, className }: { status: PresenceStatus; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("rounded-full ring-surface", STATUS_DOT[OWN_DOT[status]], className)}
    />
  );
}

/**
 * Foot of the friends column: your photo with your status, your name and the status under
 * it. Clicking it picks the status (saved on the account); the gear opens the settings.
 */
export function StatusStrip({
  account,
  status,
  compact = false,
}: {
  account: { name: string; image: string | null };
  status: PresenceStatus;
  /** The collapsed column: only the photo with the status, the menu opens to the side. */
  compact?: boolean;
}) {
  const save = useOperation(setPresenceStatus, {
    onError: () => toast.error("Não foi possível mudar o status agora."),
  });
  // Shows the choice at once; the server confirms it.
  const current = save.isPending ? (save.input?.status ?? status) : status;
  return (
    <div
      className={cn(
        "flex items-center gap-1 border-t border-line px-2 py-2",
        compact && "justify-center",
      )}
    >
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Seu status: ${OWN_STATUS_LABEL[current]}. Mudar`}
          className={cn(
            "flex min-w-0 items-center gap-2 rounded-xl px-1.5 py-1 text-left transition-colors hover:bg-surface-3 focus-visible:outline-2 focus-visible:outline-brand",
            !compact && "flex-1",
          )}
        >
          <span className="relative shrink-0">
            <UserAvatar image={account.image} className="size-9" />
            <Dot status={current} className="absolute right-0 bottom-0 size-3 ring-2" />
          </span>
          {compact ? null : (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{account.name}</span>
                <span className="block text-xs text-ink-muted">{OWN_STATUS_LABEL[current]}</span>
              </span>
              <ChevronUp className="size-4 shrink-0 text-ink-subtle" aria-hidden="true" />
            </>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side={compact ? "right" : "top"}
          align={compact ? "end" : "start"}
          className="w-64"
        >
          <DropdownMenuLabel>Seu status</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={current}
            onValueChange={(value) => {
              if (isStatus(value) && value !== current) save.execute({ status: value });
            }}
          >
            {STATUS_CHOICES.map((choice) => (
              <DropdownMenuRadioItem key={choice.status} value={choice.status} className="py-2">
                <span className="flex items-start gap-2.5">
                  <Dot status={choice.status} className="mt-1 size-2.5 shrink-0" />
                  <span>
                    <span className="block text-sm font-medium">{choice.label}</span>
                    {choice.hint ? (
                      <span className="block text-xs text-ink-muted">{choice.hint}</span>
                    ) : null}
                  </span>
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {compact ? null : <SettingsLink />}
    </div>
  );
}

function SettingsLink() {
  return (
    <Hint text="Configurações">
      <Link
        viewTransition
        to="/conta"
        aria-label="Configurações"
        className={cn(navItemClass, "w-9 shrink-0 justify-center px-0")}
      >
        <Settings className="size-4" aria-hidden="true" />
      </Link>
    </Hint>
  );
}
