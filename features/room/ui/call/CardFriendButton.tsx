import { UserCheck, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { callToast as toast } from "@/features/room/client/call-notices";
import { answerFriendRequest, sendFriendRequest } from "@/features/friends/actions";
import {
  knownFriendRelation,
  loadFriendRelation,
  rememberFriendRelation,
} from "@/features/friends/client/friend-relation-cache";
import type { FriendRelation } from "@/features/friends/domain/friend-lists";
import { useOperation } from "@/lib/operations/use-operation";
import { CardMenuItem } from "./CardMenuItem";

function showError(result: { error: { serverError?: string } }) {
  toast.error(result.error.serverError ?? "Não foi possível agora. Tente de novo.");
}

/**
 * Friendship with someone in the call; `null` while loading, and for guests (no account).
 * The card opens with what this tab already knows (or what the hover fetched) and checks again.
 */
export function useFriendRelation(userId: string | null) {
  const [relation, setRelation] = useState<FriendRelation | null>(() =>
    userId === null ? null : knownFriendRelation(userId),
  );
  useEffect(() => {
    if (userId === null) return;
    let active = true;
    async function load(id: string) {
      const found = await loadFriendRelation(id);
      if (active && found) setRelation(found);
    }
    void load(userId);
    return () => {
      active = false;
    };
  }, [userId]);

  const change = (next: FriendRelation) => {
    if (userId !== null) rememberFriendRelation(userId, next);
    setRelation(next);
  };
  const send = useOperation(sendFriendRequest, {
    onSuccess: ({ data }) => change(data.status === "friends" ? "friends" : "sent"),
    onError: showError,
  });
  const answer = useOperation(answerFriendRequest, {
    onSuccess: () => change("friends"),
    onError: showError,
  });
  return { relation, send, answer };
}

/** The friendship action on the card: add, accept, or a quiet "Pedido enviado". */
export function CardFriendItem({
  userId,
  friendship,
}: {
  userId: string;
  friendship: ReturnType<typeof useFriendRelation>;
}) {
  const { relation, send, answer } = friendship;
  if (relation === "sent") {
    return (
      <CardMenuItem icon={<UserCheck />} disabled>
        Pedido enviado
      </CardMenuItem>
    );
  }
  if (relation === "received") {
    return (
      <CardMenuItem
        icon={<UserCheck />}
        disabled={answer.isPending}
        onClick={() => answer.execute({ userId, accept: true })}
      >
        Aceitar pedido de amizade
      </CardMenuItem>
    );
  }
  if (relation !== "none") return null;
  return (
    <CardMenuItem
      icon={<UserPlus />}
      disabled={send.isPending}
      onClick={() => send.execute({ userId })}
    >
      Adicionar amigo
    </CardMenuItem>
  );
}
