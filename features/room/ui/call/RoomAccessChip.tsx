import { Check, DoorOpen, ShieldCheck } from "lucide-react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { roomAccess, setRoomAccess } from "@/features/room/actions";
import {
  ROOM_ACCESS_HINT,
  ROOM_ACCESS_LABEL,
  ROOM_ACCESS_MODES,
  managesRoomAccess,
  type RoomAccess,
} from "@/features/room/domain/room-access";
import { useLocalRoomRole } from "@/features/room/hooks/use-room-roles";
import { useOperation } from "@/lib/operations/use-operation";
import { cn } from "@/lib/utils";

const CHIP =
  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-line px-3 text-sm font-medium";

function AccessIcon({ access }: { access: RoomAccess }) {
  if (access === "approval") return <ShieldCheck className="size-4" aria-hidden="true" />;
  return <DoorOpen className="size-4" aria-hidden="true" />;
}

/**
 * How people get into the room. The owner and moderators open it to choose; the others only
 * see it while the room asks for approval.
 */
export function RoomAccessChip({ code }: { code: string }) {
  const role = useLocalRoomRole();
  const [state, setState] = useState<{ access: RoomAccess; canManage: boolean } | null>(null);
  useEffect(() => {
    let active = true;
    async function load() {
      const result = await roomAccess({ room: code });
      if (active && result.data) {
        setState({ ...result.data, canManage: result.data.canManage && managesRoomAccess(role) });
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [code, role]);

  const [open, setOpen] = useState(false);
  const [previous, setPrevious] = useState<RoomAccess | null>(null);
  const save = useOperation(setRoomAccess, {
    onSuccess: ({ data }) => setState((current) => current && { ...current, access: data.access }),
    onError: ({ error }) => {
      // The chip showed the choice at once; put the old one back.
      setState((current) => (current && previous ? { ...current, access: previous } : current));
      toast.error(error.serverError ?? "Não foi possível mudar agora.");
    },
  });

  /** Closes the menu and shows the choice right away; the server confirms it. */
  function choose(access: RoomAccess) {
    setOpen(false);
    if (!state || state.access === access) return;
    setPrevious(state.access);
    setState({ ...state, access });
    save.execute({ room: code, access });
  }

  if (!state) return null;
  const label = ROOM_ACCESS_LABEL[state.access];
  if (!state.canManage || !managesRoomAccess(role)) {
    if (state.access === "open") return null;
    return (
      <span className={cn(CHIP, "text-ink-muted")}>
        <AccessIcon access={state.access} />
        <span className="max-sm:sr-only">{label}</span>
      </span>
    );
  }
  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger
        aria-label={`Entrada da sala: ${label}. Mudar`}
        className={cn(CHIP, "transition-colors hover:bg-surface-3")}
      >
        <AccessIcon access={state.access} />
        <span className="max-sm:sr-only">{label}</span>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side="bottom"
          align="start"
          sideOffset={10}
          collisionPadding={16}
          aria-label="Entrada da sala"
          className="glass z-50 w-72 rounded-2xl p-2 outline-none"
        >
          {ROOM_ACCESS_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={state.access === mode}
              disabled={save.isPending}
              onClick={() => choose(mode)}
              className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-3"
            >
              <AccessIcon access={mode} />
              <span className="min-w-0 flex-1">
                <span className="block text-base font-medium">{ROOM_ACCESS_LABEL[mode]}</span>
                <span className="block text-sm text-ink-muted">{ROOM_ACCESS_HINT[mode]}</span>
              </span>
              {state.access === mode ? (
                <Check className="mt-1 size-4 text-brand-soft" aria-hidden="true" />
              ) : null}
            </button>
          ))}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
