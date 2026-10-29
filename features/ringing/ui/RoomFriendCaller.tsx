import { Check, Phone } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router";
import { toast } from "sonner";
import { InitialsAvatar } from "@/components/InitialsAvatar";
import { PresenceDot } from "@/components/PresenceDot";
import { SearchField } from "@/components/SearchField";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { friendPhotoPath, type FriendStatus } from "@/features/friends/domain/friend-lists";
import { canBeCalled, SHOWN_STATUS_LABEL } from "@/features/friends/domain/presence-status";
import { ringFriend, useCalling } from "@/features/ringing/client/calling";
import { friendsToCall } from "@/features/ringing/domain/friend-choice";
import { usePageSlot } from "@/features/ringing/client/use-page-slot";
import { searchable } from "@/lib/search-text";
import { cn } from "@/lib/utils";

/** The empty room's invite card leaves this spot free. */
const INVITE_SLOT_ID = "room-invite-actions";

/** Rings each chosen friend into the room; says how many could not be rung. */
async function ringAll(room: string, friendIds: string[]) {
  if (friendIds.length === 0) {
    toast.error("Não dá para chamar agora.");
    return;
  }
  const results = await Promise.all(friendIds.map((friendId) => ringFriend({ room, friendId })));
  const failed = results.filter((result) => result !== null && !result.data?.ringId).length;
  if (failed === 0) return;
  toast.error(
    failed === friendIds.length
      ? "Não dá para chamar agora."
      : "Alguns amigos não puderam ser chamados.",
  );
}

/** One friend in the window: photo with their status, name, and a check when chosen. */
function FriendChoice({
  friend,
  checked,
  onToggle,
}: {
  friend: FriendStatus;
  checked: boolean;
  onToggle: () => void;
}) {
  const ringing = useCalling(friend.id).calling;
  const chosen = ringing || checked;
  return (
    <li>
      <label className="flex w-full cursor-pointer items-center gap-3 rounded-2xl px-2 py-1.5 hover:bg-surface-3 has-focus-visible:outline-2 has-focus-visible:outline-brand has-disabled:cursor-default">
        <input
          type="checkbox"
          checked={chosen}
          disabled={ringing}
          onChange={onToggle}
          className="sr-only"
        />
        <span className="relative shrink-0">
          <InitialsAvatar
            name={friend.name}
            source={friendPhotoPath(friend.id)}
            className="size-9 bg-brand/15 text-sm font-medium text-brand-soft"
          />
          <PresenceDot status={friend.status} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-semibold">{friend.name}</span>
          <span className="text-xs text-ink-muted">
            {ringing ? "Chamando…" : SHOWN_STATUS_LABEL[friend.status]}
          </span>
        </span>
        <span
          aria-hidden="true"
          className={cn(
            "grid size-5 place-items-center rounded-md border-2",
            chosen ? "border-brand bg-brand text-brand-ink" : "border-line-strong",
          )}
        >
          {chosen ? <Check className="size-3.5" strokeWidth={3} /> : null}
        </span>
      </label>
    </li>
  );
}

/** The friends that match the search, under "Online · N"; a note when there are none. */
function FriendList({
  friends,
  searching,
  chosen,
  onToggle,
}: {
  friends: FriendStatus[];
  searching: boolean;
  chosen: ReadonlySet<string>;
  onToggle: (id: string) => void;
}) {
  if (friends.length === 0) {
    return (
      <p className="px-2 py-3 text-sm text-ink-muted">
        {searching ? "Nenhum amigo com esse nome." : "Nenhum amigo disponível agora."}
      </p>
    );
  }
  return (
    <section aria-label="Online" className="flex flex-col gap-1">
      <h3 className="px-2 text-xs font-semibold tracking-wide text-ink-subtle uppercase">
        Online · {friends.length}
      </h3>
      <ul aria-label="Amigos para chamar" className="flex flex-col">
        {friends.map((friend) => (
          <FriendChoice
            key={friend.id}
            friend={friend}
            checked={chosen.has(friend.id)}
            onToggle={() => onToggle(friend.id)}
          />
        ))}
      </ul>
    </section>
  );
}

/**
 * "Chamar amigos": one button on the invite card that opens a window to search and pick
 * friends, so a long friend list never spills over the room.
 */
function FriendPicker({ room, friends }: { room: string; friends: FriendStatus[] }) {
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sending, setSending] = useState(false);
  const wanted = searchable(query.trim());
  const callable = friends.filter((friend) => canBeCalled(friend.status));
  const shown = callable.filter(
    (friend) => wanted === "" || searchable(friend.name).includes(wanted),
  );

  const toggle = (id: string) => {
    const next = new Set(chosen);
    if (!next.delete(id)) next.add(id);
    setChosen(next);
  };

  const openChange = (next: boolean) => {
    setOpen(next);
    if (next) return;
    setQuery("");
    setChosen(new Set());
  };

  const ring = async () => {
    setSending(true);
    try {
      await ringAll(room, friendsToCall(friends, chosen));
    } finally {
      setSending(false);
      openChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={openChange}>
      {/* The trigger gives focus back to this button when the window closes. */}
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="secondary" className="h-9 w-full">
          <Phone aria-hidden="true" />
          Chamar amigos
        </Button>
      </DialogTrigger>
      <DialogContent
        showCloseButton
        className="flex h-[min(max(50dvh,24rem),calc(100dvh-2rem))] flex-col max-sm:top-auto max-sm:bottom-0 max-sm:max-w-full max-sm:translate-y-0 max-sm:rounded-b-none"
      >
        <DialogTitle>Chamar amigos</DialogTitle>
        <DialogDescription className="sr-only">
          Escolha quem chamar para esta sala.
        </DialogDescription>
        <SearchField label="Buscar amigo" value={query} onChange={setQuery} />
        <div className="-mx-2 min-h-0 flex-1 overflow-y-auto">
          <FriendList friends={shown} searching={wanted !== ""} chosen={chosen} onToggle={toggle} />
        </div>
        <Button
          type="button"
          className="w-full"
          disabled={chosen.size === 0 || sending}
          onClick={() => void ring()}
        >
          <Phone aria-hidden="true" />
          {chosen.size > 1 ? `Chamar ${chosen.size}` : "Chamar"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

/** "Chamar amigos" on the empty room's invite card: rings Online and Ausente friends into it. */
export function RoomFriendCaller({ friends }: { friends: FriendStatus[] }) {
  const { pathname } = useLocation();
  const room = pathname.startsWith("/sala/") ? (pathname.split("/").at(-1) ?? null) : null;
  const slot = usePageSlot(INVITE_SLOT_ID, room !== null);
  if (!slot || !room) return null;
  return createPortal(<FriendPicker room={room} friends={friends} />, slot);
}
