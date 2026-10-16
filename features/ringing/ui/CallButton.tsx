import { Phone, X } from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { toast } from "sonner";
import { Hint } from "@/components/Hint";
import { Button } from "@/components/ui/button";
import { answeredCallPath } from "@/features/room/domain/answered-call";
import { createRoomAction } from "@/features/room/actions";
import { callGroup } from "@/features/ringing/actions";
import { cancelCalling, ringFriend, useCalling } from "@/features/ringing/client/calling";
import { savePendingCall, type PendingCall } from "@/features/ringing/client/pending-call";
import { cn } from "@/lib/utils";

type Status = "online" | "away" | "busy" | "offline";

const OUTLINE =
  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-brand";

/** The text "Chamar" buttons: the green outline at the column's h-8. */
const CALL_TEXT = "h-8 gap-1.5 px-3 text-sm font-semibold";

/** Busy: the outline greys out and hovering does not fill it. */
const UNAVAILABLE_OUTLINE =
  "cursor-not-allowed border-line-strong text-ink-subtle hover:border-line-strong hover:bg-transparent hover:text-ink-subtle";

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? name;
}

/** The room code at the end of "/sala/abc-defg-hij". */
function codeFromPath(path: string): string | null {
  return path.split("?")[0]?.split("/").at(-1) || null;
}

/** The room code when the page is a room's, else null. */
function roomOnPage(pathname: string): string | null {
  if (!pathname.startsWith("/sala/")) return null;
  return codeFromPath(pathname);
}

type Waiting = DistributiveOmit<PendingCall, "room">;
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/**
 * Outside a call: keeps the call waiting and rings once you are in. On a room's page (before
 * joining, or before the server knows you joined) that room; elsewhere a new one.
 */
function useOpenRoom() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return async (waiting: Waiting, active: () => boolean = () => true) => {
    if (!active()) return;
    const here = roomOnPage(pathname);
    if (here) {
      savePendingCall({ ...waiting, room: here });
      return;
    }
    // A room opened by Chamar asks for approval: whoever is rung still goes straight in.
    const created = await createRoomAction({ access: "approval" });
    if (!active()) return;
    const room = created.data ? codeFromPath(created.data.path) : null;
    if (!created.data || !room) {
      toast.error(created.serverError ?? "Não foi possível criar a sala.");
      return;
    }
    savePendingCall({ ...waiting, room });
    // Whoever pressed Chamar already chose to call: the new room joins without the pre-join.
    void navigate(answeredCallPath(created.data.path), { viewTransition: true });
  };
}

/**
 * Rings the friend into the call you are in (the server knows it, the page may not yet), or
 * opens a room and rings once you are in.
 */
export function useCallFriend(friend: { id: string; name: string }) {
  const openRoom = useOpenRoom();
  const [starting, setStarting] = useState(false);
  const call = async () => {
    setStarting(true);
    try {
      const result = await ringFriend({ friendId: friend.id }, (active) =>
        openRoom({ kind: "friend", friendId: friend.id, name: friend.name }, active),
      );
      if (result && !result.data) toast.error(result.serverError ?? "Unable to call right now.");
    } finally {
      setStarting(false);
    }
  };
  return { call, starting };
}

/**
 * "Chamar" for a friend who can take a call; "Chamando…" with Cancelar while it rings.
 * Não perturbe shows it disabled; Invisível and Offline show nothing.
 */
export function CallButton({
  friend,
  className,
}: {
  friend: { id: string; name: string; status: Status };
  className?: string;
}) {
  const { ringId, calling } = useCalling(friend.id);
  const { call, starting } = useCallFriend(friend);
  if (friend.status === "offline") return null;
  if (calling) {
    return (
      <button
        type="button"
        onClick={() => cancelCalling(friend.id, ringId)}
        aria-label={`Chamando ${firstName(friend.name)}. Cancelar`}
        className={cn(OUTLINE, "border-line-strong text-ink-muted hover:text-ink", className)}
      >
        <X className="size-4" aria-hidden="true" />
        Chamando…
      </button>
    );
  }
  const busy = friend.status === "busy";
  return (
    <Hint text={busy ? "Não perturbe" : undefined}>
      <Button
        type="button"
        variant="brand-outline"
        size="sm"
        aria-disabled={busy || starting}
        onClick={() => {
          if (!busy && !starting) void call();
        }}
        className={cn(CALL_TEXT, busy && UNAVAILABLE_OUTLINE, className)}
      >
        <Phone className="size-4" aria-hidden="true" />
        Chamar
      </Button>
    </Hint>
  );
}

const ICON =
  "grid size-9 shrink-0 place-items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-brand";

/** Why the round button cannot call now, for the hint. */
const UNAVAILABLE: Partial<Record<Status, string>> = {
  busy: "Não perturbe",
  offline: "Offline agora",
};

/** The round "Chamar" of a conversation's header: the same states as CallButton, as an icon. */
export function IconCallButton({
  friend,
}: {
  friend: { id: string; name: string; status: Status };
}) {
  const { ringId, calling } = useCalling(friend.id);
  const { call, starting } = useCallFriend(friend);
  if (calling) {
    return (
      <Hint text="Cancelar chamada">
        <button
          type="button"
          onClick={() => cancelCalling(friend.id, ringId)}
          aria-label={`Chamando ${firstName(friend.name)}. Cancelar`}
          className={cn(ICON, "bg-brand text-brand-ink motion-safe:animate-pulse")}
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </Hint>
    );
  }
  const unavailable = UNAVAILABLE[friend.status];
  return (
    <Hint text={unavailable ?? "Chamar"}>
      <button
        type="button"
        aria-label={`Chamar ${firstName(friend.name)}`}
        aria-disabled={Boolean(unavailable) || starting}
        onClick={() => {
          if (!unavailable && !starting) void call();
        }}
        className={cn(
          ICON,
          unavailable
            ? "cursor-not-allowed text-ink-subtle"
            : "text-ink-muted hover:bg-surface-3 hover:text-ink",
        )}
      >
        <Phone className="size-5" aria-hidden="true" />
      </button>
    </Hint>
  );
}

/** "Chamar o grupo": starts the group's call in your room (a new one if needed) and rings everyone. */
export function GroupCallButton({
  conversationId,
  name,
  className,
}: {
  conversationId: string;
  name: string;
  className?: string;
}) {
  const openRoom = useOpenRoom();
  const [starting, setStarting] = useState(false);
  const start = async () => {
    setStarting(true);
    const result = await callGroup({ conversationId });
    if (result.data?.needsRoom) await openRoom({ kind: "group", conversationId, name });
    setStarting(false);
    if (!result.data) toast.error(result.serverError ?? "Não foi possível chamar agora.");
  };
  return (
    <Button
      type="button"
      variant="brand-outline"
      size="sm"
      aria-disabled={starting}
      onClick={() => {
        if (!starting) void start();
      }}
      className={cn(CALL_TEXT, className)}
    >
      <Phone className="size-4" aria-hidden="true" />
      Chamar o grupo
    </Button>
  );
}
