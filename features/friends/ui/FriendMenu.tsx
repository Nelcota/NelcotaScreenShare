import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
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

/** "…" on a friend: undo the friendship or block. */
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
  const remove = useOperation(removeFriend, { onSuccess: () => onDone?.(), onError: showError });
  const block = useOperation(blockUser, { onSuccess: () => onDone?.(), onError: showError });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size={size}
          variant="ghost"
          aria-label={`Opções para ${person.name}`}
          className={cn("shrink-0", className)}
        >
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuItem onSelect={() => remove.execute({ userId: person.id })}>
          Desfazer amizade
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => block.execute({ userId: person.id })}
        >
          Bloquear
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
