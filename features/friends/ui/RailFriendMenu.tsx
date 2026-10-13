import { MessageCircle, Phone, UserRound, X } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { Hint } from "@/components/Hint";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { FriendStatus } from "@/features/friends/domain/friend-lists";
import { canBeCalled, SHOWN_STATUS_LABEL } from "@/features/friends/domain/presence-status";
import { FriendAvatar } from "@/features/friends/ui/FriendAvatar";
import { openDirectConversation } from "@/features/messages/actions";
import { cancelCalling, useCalling } from "@/features/ringing/client/calling";
import { useCallFriend } from "@/features/ringing/ui/CallButton";
import { cn } from "@/lib/utils";

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? name;
}

/** "Mensagem": opens (or starts) the conversation with the friend. */
function useOpenMessages(friendId: string) {
  const navigate = useNavigate();
  return async () => {
    const result = await openDirectConversation({ userId: friendId });
    if (!result.data) {
      toast.error(result.serverError ?? "Não foi possível abrir a conversa.");
      return;
    }
    void navigate(`/mensagens/${result.data.conversationId}`, { viewTransition: true });
  };
}

/** Chamar, Cancelar while it rings, or Chamar disabled for someone Ocupado. */
function CallItem({ friend }: { friend: FriendStatus }) {
  const { ringId, calling } = useCalling(friend.id);
  const { call, starting } = useCallFriend(friend);
  if (calling) {
    return (
      <DropdownMenuItem onSelect={() => cancelCalling(friend.id, ringId)}>
        <X aria-hidden="true" />
        Cancelar chamada
      </DropdownMenuItem>
    );
  }
  if (!canBeCalled(friend.status)) {
    return (
      <DropdownMenuItem disabled className="flex-col items-start gap-0.5">
        <span className="flex items-center gap-2">
          <Phone aria-hidden="true" className="size-4" />
          Chamar
        </span>
        <span className="pl-6 text-xs">Ocupado agora</span>
      </DropdownMenuItem>
    );
  }
  return (
    <DropdownMenuItem disabled={starting} onSelect={() => void call()}>
      <Phone aria-hidden="true" />
      Chamar
    </DropdownMenuItem>
  );
}

/**
 * A friend on the rail: the avatar opens Chamar, Mensagem and their card, so a call can start
 * without opening the column (in a room it rings into that room).
 */
export function RailFriendMenu({ friend, unread }: { friend: FriendStatus; unread: number }) {
  const openMessages = useOpenMessages(friend.id);
  const { calling } = useCalling(friend.id);
  const label = calling ? `Chamando ${firstName(friend.name)}…` : friend.name;
  return (
    <DropdownMenu>
      <Hint text={label}>
        <DropdownMenuTrigger
          aria-label={label}
          className="grid size-11 place-items-center rounded-2xl transition-colors hover:bg-surface-3 focus-visible:outline-2 focus-visible:outline-brand data-[state=open]:bg-surface-3"
        >
          <span
            className={cn(
              "rounded-full",
              calling &&
                "ring-2 ring-brand ring-offset-2 ring-offset-surface motion-safe:animate-pulse",
            )}
          >
            <FriendAvatar friend={friend} unread={unread} />
          </span>
        </DropdownMenuTrigger>
      </Hint>
      <DropdownMenuContent side="right" align="start" className="min-w-48">
        <DropdownMenuLabel className="flex flex-col">
          <span className="truncate">{friend.name}</span>
          <span className="text-xs font-normal text-ink-muted">
            {calling ? "Chamando…" : SHOWN_STATUS_LABEL[friend.status]}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <CallItem friend={friend} />
        <DropdownMenuItem onSelect={() => void openMessages()}>
          <MessageCircle aria-hidden="true" />
          Mensagem
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to={`/amigos/${friend.id}`} viewTransition>
            <UserRound aria-hidden="true" />
            Ver perfil
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
