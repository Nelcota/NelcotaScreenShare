import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { InitialsAvatar } from "@/components/InitialsAvatar";
import { Button } from "@/components/ui/button";
import { unblockUser } from "@/features/friends/actions";
import type { FriendPerson } from "@/features/friends/domain/friend-lists";
import { useOperation } from "@/lib/operations/use-operation";

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? name;
}

/** The people this account blocked, each with Desbloquear (after confirming). */
export function BlockedList({ people }: { people: readonly FriendPerson[] }) {
  const [unblocking, setUnblocking] = useState<FriendPerson | null>(null);
  const unblock = useOperation(unblockUser, {
    onSuccess: () => {
      setUnblocking(null);
      toast.success("Bloqueio desfeito.");
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Não foi possível agora."),
  });
  if (people.length === 0) return <p className="text-sm text-ink-muted">Ninguém bloqueado.</p>;
  const name = unblocking ? firstName(unblocking.name) : "";
  return (
    <>
      <ul className="flex flex-col">
        {people.map((person) => (
          <li
            key={person.id}
            className="flex items-center gap-3 py-2.5 [&+&]:border-t [&+&]:border-line"
          >
            <InitialsAvatar
              name={person.name}
              source={null}
              className="size-9 shrink-0 bg-surface-3 text-sm font-medium text-ink-muted"
            />
            <span className="min-w-0 flex-1 truncate font-medium">{person.name}</span>
            <Button variant="outline" size="sm" onClick={() => setUnblocking(person)}>
              Desbloquear
            </Button>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={unblocking !== null}
        onOpenChange={(open) => {
          if (!open) setUnblocking(null);
        }}
        title={`Desbloquear ${name}?`}
        description={`${name} volta a poder te mandar pedido de amizade. A amizade não volta sozinha.`}
        confirmLabel="Desbloquear"
        pending={unblock.isPending}
        onConfirm={() => {
          if (unblocking) unblock.execute({ userId: unblocking.id });
        }}
      />
    </>
  );
}
