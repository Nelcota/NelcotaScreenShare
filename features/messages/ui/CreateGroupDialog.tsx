import { Check } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { InitialsAvatar } from "@/components/InitialsAvatar";
import { PresenceDot, type Presence } from "@/components/PresenceDot";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { friendPhotoPath } from "@/features/friends/domain/friend-lists";
import { createGroupConversation } from "@/features/messages/actions";
import {
  groupPickNote,
  MAX_GROUP_MEMBERS,
  MIN_GROUP_INVITEES,
} from "@/features/messages/domain/conversation";
import { useOperation } from "@/lib/operations/use-operation";
import { cn } from "@/lib/utils";

export interface PickableFriend {
  id: string;
  name: string;
  status: Presence;
}

/** Friends you can add besides yourself. */
const MAX_PICKED = MAX_GROUP_MEMBERS - 1;

function PickRow({
  friend,
  picked,
  disabled,
  onToggle,
}: {
  friend: PickableFriend;
  picked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <li>
      <label className="flex w-full cursor-pointer items-center gap-3 rounded-2xl px-2 py-1.5 hover:bg-surface-3 has-focus-visible:outline-2 has-focus-visible:outline-brand has-disabled:cursor-default has-disabled:opacity-50">
        <input
          type="checkbox"
          checked={picked}
          disabled={disabled}
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
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{friend.name}</span>
        <span
          aria-hidden="true"
          className={cn(
            "grid size-5 place-items-center rounded-md border-2",
            picked ? "border-brand bg-brand text-brand-ink" : "border-line-strong",
          )}
        >
          {picked ? <Check className="size-3.5" strokeWidth={3} /> : null}
        </span>
      </label>
    </li>
  );
}

function onError({ error }: { error: { serverError?: string } }) {
  toast.error(error.serverError ?? "Não foi possível agora. Tente de novo.");
}

function useStart(onDone: () => void) {
  const navigate = useNavigate();
  const open = (conversationId: string) => {
    onDone();
    void navigate(`/mensagens/${conversationId}`, { viewTransition: true });
  };
  const group = useOperation(createGroupConversation, {
    onSuccess: ({ data }) => open(data.conversationId),
    onError,
  });
  return { group, pending: group.isPending };
}

/** "Criar grupo": pick two or more friends; the group is named after them. */
function NewGroupForm({ friends, onDone }: { friends: PickableFriend[]; onDone: () => void }) {
  const [picked, setPicked] = useState<string[]>([]);
  const start = useStart(onDone);
  const pickedEnough = picked.length >= MIN_GROUP_INVITEES;
  const note = groupPickNote(picked.length, friends.length);
  const toggle = (id: string) =>
    setPicked((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  const submit = () => start.group.execute({ memberIds: picked, name: null });
  return (
    <div className="flex min-h-0 flex-col gap-4">
      <p className="flex justify-between px-2 text-xs font-semibold tracking-wide text-ink-subtle uppercase">
        <span>Amigos</span>
        <span>
          {MIN_GROUP_INVITEES} a {MAX_PICKED} amigos
        </span>
      </p>
      {friends.length === 0 ? (
        <p className="px-2 text-sm text-ink-muted">Adicione amigos para conversar.</p>
      ) : (
        <ul className="-mt-2 max-h-80 min-h-0 overflow-y-auto">
          {friends.map((friend) => (
            <PickRow
              key={friend.id}
              friend={friend}
              picked={picked.includes(friend.id)}
              disabled={!picked.includes(friend.id) && picked.length >= MAX_PICKED}
              onToggle={() => toggle(friend.id)}
            />
          ))}
        </ul>
      )}
      <p aria-live="polite" className="px-2 text-center text-sm text-ink-muted empty:hidden">
        {note}
      </p>
      <Button
        size="lg"
        disabled={!pickedEnough || start.pending}
        onClick={submit}
        className="w-full"
      >
        Criar grupo
      </Button>
    </div>
  );
}

/** "Criar grupo" in a window, opened from the column's "+" menu. */
export function CreateGroupWindow({
  friends,
  open,
  onOpenChange,
  onCloseAutoFocus,
}: {
  friends: PickableFriend[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus?: (event: Event) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" showCloseButton onCloseAutoFocus={onCloseAutoFocus}>
        <DialogTitle>Criar grupo</DialogTitle>
        <DialogDescription className="sr-only">Escolha dois ou mais amigos.</DialogDescription>
        {open ? <NewGroupForm friends={friends} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}
