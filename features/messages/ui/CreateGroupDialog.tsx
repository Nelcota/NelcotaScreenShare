import { Check, UsersRound } from "lucide-react";
import { useId, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Hint } from "@/components/Hint";
import { InitialsAvatar } from "@/components/InitialsAvatar";
import { PresenceDot, type Presence } from "@/components/PresenceDot";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { friendPhotoPath } from "@/features/friends/domain/friend-lists";
import { createGroupConversation } from "@/features/messages/actions";
import { firstName, joinNames } from "@/features/messages/domain/conversation-display";
import { MAX_GROUP_MEMBERS, MAX_GROUP_NAME_LENGTH } from "@/features/messages/domain/conversation";
import { useOperation } from "@/lib/operations/use-operation";
import { cn } from "@/lib/utils";

export interface PickableFriend {
  id: string;
  name: string;
  status: Presence;
}

/** Friends you can add besides yourself. */
const MAX_PICKED = MAX_GROUP_MEMBERS - 1;
/** A group has you and at least two friends; one friend is their conversation. */
const MIN_PICKED = 2;

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

/** "Criar grupo": pick two or more friends and, if you like, a name. */
function NewGroupForm({ friends, onDone }: { friends: PickableFriend[]; onDone: () => void }) {
  const nameId = useId();
  const [picked, setPicked] = useState<string[]>([]);
  const [name, setName] = useState("");
  const start = useStart(onDone);
  const pickedFriends = friends.filter((friend) => picked.includes(friend.id));
  const isGroup = picked.length > 1;
  const pickedEnough = picked.length >= MIN_PICKED;
  const toggle = (id: string) =>
    setPicked((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  const submit = () => start.group.execute({ memberIds: picked, name: name.trim() || null });
  return (
    <div className="flex min-h-0 flex-col gap-4">
      {isGroup ? (
        <label htmlFor={nameId} className="flex flex-col gap-2 text-sm font-medium">
          Nome do grupo
          <input
            id={nameId}
            value={name}
            maxLength={MAX_GROUP_NAME_LENGTH}
            onChange={(event) => setName(event.target.value)}
            placeholder={`${joinNames(pickedFriends.map((friend) => firstName(friend.name)))} e você`}
            className="h-11 rounded-xl border border-line-strong bg-surface-2 px-3 text-base font-normal outline-none placeholder:text-ink-subtle focus:border-brand-soft"
          />
        </label>
      ) : null}
      <p className="flex justify-between px-2 text-xs font-semibold tracking-wide text-ink-subtle uppercase">
        <span>Amigos</span>
        <span>
          {picked.length} de {MAX_PICKED}
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

/** "Criar grupo" in the column's header, next to "Adicionar amigo". */
export function CreateGroupDialog({ friends }: { friends: PickableFriend[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Hint text="Criar grupo">
        <DialogTrigger
          aria-label="Criar grupo"
          className="grid size-9 shrink-0 place-items-center rounded-full border border-brand-soft/70 text-brand-soft transition-colors hover:border-brand hover:bg-brand hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-brand"
        >
          <UsersRound className="size-4" aria-hidden="true" />
        </DialogTrigger>
      </Hint>
      <DialogContent className="max-w-md rounded-3xl" showCloseButton>
        <DialogTitle>Criar grupo</DialogTitle>
        <DialogDescription className="sr-only">Escolha dois ou mais amigos.</DialogDescription>
        {open ? <NewGroupForm friends={friends} onDone={() => setOpen(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}
