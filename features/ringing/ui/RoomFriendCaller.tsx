import { Phone } from "lucide-react";
import { useId, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { FriendStatus } from "@/features/friends/domain/friend-lists";
import { canBeCalled, SHOWN_STATUS_LABEL } from "@/features/friends/domain/presence-status";
import { ringFriend, useCalling } from "@/features/ringing/client/calling";
import { usePageSlot } from "@/features/ringing/client/use-page-slot";

/** The empty room's invite card leaves this spot free. */
const INVITE_SLOT_ID = "room-invite-actions";

/** Rings each chosen friend into the room; says how many could not be rung. */
async function ringAll(room: string, friendIds: string[]) {
  const results = await Promise.all(friendIds.map((friendId) => ringFriend({ room, friendId })));
  const failed = results.filter((result) => result !== null && !result.data?.ringId).length;
  if (failed === 0) return;
  toast.error(
    failed === friendIds.length
      ? "Não dá para chamar agora."
      : "Alguns amigos não puderam ser chamados.",
  );
}

function FriendChoice({
  friend,
  checked,
  onToggle,
}: {
  friend: FriendStatus;
  checked: boolean;
  onToggle: () => void;
}) {
  const id = useId();
  const ringing = useCalling(friend.id).calling;
  return (
    <li className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-surface-3">
      <Checkbox
        id={id}
        checked={ringing || checked}
        disabled={ringing}
        onCheckedChange={onToggle}
      />
      <label htmlFor={id} className="flex min-w-0 flex-1 flex-col text-sm">
        <span className="truncate font-medium">{friend.name}</span>
        <span className="text-xs text-ink-muted">
          {ringing ? "Chamando…" : SHOWN_STATUS_LABEL[friend.status]}
        </span>
      </label>
    </li>
  );
}

function FriendPicker({ room, friends }: { room: string; friends: FriendStatus[] }) {
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const callable = friends.filter((friend) => canBeCalled(friend.status));

  const toggle = (id: string) => {
    const next = new Set(chosen);
    if (!next.delete(id)) next.add(id);
    setChosen(next);
  };

  const ring = async () => {
    setSending(true);
    await ringAll(room, [...chosen]);
    setSending(false);
    setChosen(new Set());
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" size="sm" variant="secondary" className="shrink-0">
          <Phone aria-hidden="true" />
          Chamar amigo
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-2">
        {callable.length === 0 ? (
          <p className="px-2 py-3 text-sm text-ink-muted">Nenhum amigo disponível agora.</p>
        ) : (
          <ul aria-label="Amigos para chamar" className="flex max-h-64 flex-col overflow-y-auto">
            {callable.map((friend) => (
              <FriendChoice
                key={friend.id}
                friend={friend}
                checked={chosen.has(friend.id)}
                onToggle={() => toggle(friend.id)}
              />
            ))}
          </ul>
        )}
        {callable.length > 0 ? (
          <Button
            type="button"
            className="mt-2 w-full"
            disabled={chosen.size === 0 || sending}
            onClick={() => void ring()}
          >
            <Phone aria-hidden="true" />
            {chosen.size > 1 ? `Chamar ${chosen.size}` : "Chamar"}
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

/** "Chamar amigo" on the empty room's invite card: rings Online and Ausente friends into it. */
export function RoomFriendCaller({ friends }: { friends: FriendStatus[] }) {
  const { pathname } = useLocation();
  const room = pathname.startsWith("/sala/") ? (pathname.split("/").at(-1) ?? null) : null;
  const slot = usePageSlot(INVITE_SLOT_ID, room !== null);
  if (!slot || !room) return null;
  return createPortal(<FriendPicker room={room} friends={friends} />, slot);
}
