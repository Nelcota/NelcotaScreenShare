import type { ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { answerFriendRequest, cancelFriendRequest } from "@/features/friends/actions";
import { friendPhotoPath, type FriendPerson } from "@/features/friends/domain/friend-lists";
import { InitialsAvatar } from "@/components/InitialsAvatar";
import { useOperation } from "@/lib/operations/use-operation";

function showError(result: { error: { serverError?: string } }) {
  toast.error(result.error.serverError ?? "Não foi possível agora. Tente de novo.");
}

function PersonRow({
  person,
  detail,
  children,
}: {
  person: FriendPerson;
  detail?: string;
  children: ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 py-3">
      <InitialsAvatar
        name={person.name}
        source={friendPhotoPath(person.id)}
        className="size-10 shrink-0 bg-brand/15 text-sm font-medium text-brand-soft"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-medium">{person.name}</span>
        {detail ? <span className="block text-sm text-ink-muted">{detail}</span> : null}
      </span>
      <span className="flex shrink-0 items-center gap-2">{children}</span>
    </li>
  );
}

export function ReceivedRow({ person }: { person: FriendPerson }) {
  const answer = useOperation(answerFriendRequest, { onError: showError });
  return (
    <PersonRow person={person}>
      <Button
        size="sm"
        disabled={answer.isPending}
        onClick={() => answer.execute({ userId: person.id, accept: true })}
      >
        Aceitar
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={answer.isPending}
        onClick={() => answer.execute({ userId: person.id, accept: false })}
      >
        Recusar
      </Button>
    </PersonRow>
  );
}

export function SentRow({ person }: { person: FriendPerson }) {
  const cancel = useOperation(cancelFriendRequest, { onError: showError });
  return (
    <PersonRow person={person}>
      <Button
        size="sm"
        variant="ghost"
        disabled={cancel.isPending}
        onClick={() => cancel.execute({ userId: person.id })}
      >
        Cancelar
      </Button>
    </PersonRow>
  );
}
