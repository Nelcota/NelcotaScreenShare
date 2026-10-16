import { Ellipsis } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { blockUser, removeFriend } from "@/features/friends/actions";
import type { FriendPerson } from "@/features/friends/domain/friend-lists";
import { useOperation } from "@/lib/operations/use-operation";
import { cn } from "@/lib/utils";

function showError(result: { error: { serverError?: string } }) {
  toast.error(result.error.serverError ?? "Não foi possível agora. Tente de novo.");
}

function firstName(name: string) {
  return name.trim().split(" ")[0] ?? name;
}

/** "…" on a friend: undo the friendship or block, each after confirming. */
export function FriendMenu({
  person,
  size = "icon-sm",
  className,
  onDone,
}: {
  person: FriendPerson;
  size?: "icon-sm" | "icon";
  className?: string;
  /** After the friend is gone (e.g. leave their card). */
  onDone?: () => void;
}) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const remove = useOperation(removeFriend, {
    onSuccess: () => {
      setConfirmRemove(false);
      onDone?.();
    },
    onError: showError,
  });
  const [confirmBlock, setConfirmBlock] = useState(false);
  const block = useOperation(blockUser, {
    onSuccess: () => {
      setConfirmBlock(false);
      onDone?.();
    },
    onError: showError,
  });
  const name = firstName(person.name);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size={size}
            variant="ghost"
            aria-label={`Opções para ${person.name}`}
            className={cn("shrink-0", className)}
          >
            <Ellipsis aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          <DropdownMenuItem onSelect={() => setConfirmRemove(true)}>
            Desfazer amizade
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmBlock(true)}>
            Bloquear
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={`Desfazer amizade com ${name}?`}
        description="Vocês não podem mais se chamar nem trocar mensagens. Para voltar, alguém manda um novo pedido."
        confirmLabel="Desfazer amizade"
        danger
        pending={remove.isPending}
        onConfirm={() => remove.execute({ userId: person.id })}
      />
      <ConfirmDialog
        open={confirmBlock}
        onOpenChange={setConfirmBlock}
        title={`Bloquear ${name}?`}
        description={`A amizade acaba, e ${name} não consegue mais te chamar nem mandar mensagem. ${name} não fica sabendo.`}
        confirmLabel="Bloquear"
        danger
        pending={block.isPending}
        onConfirm={() => block.execute({ userId: person.id })}
      />
    </>
  );
}
