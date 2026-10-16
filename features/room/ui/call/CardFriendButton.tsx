import { UserCheck, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { callToast as toast } from "@/features/room/client/call-notices";
import { answerFriendRequest, friendRelation, sendFriendRequest } from "@/features/friends/actions";
import type { FriendRelation } from "@/features/friends/domain/friend-lists";
import { useOperation } from "@/lib/operations/use-operation";
import { CardMenuItem } from "./CardMenuItem";

function showError(result: { error: { serverError?: string } }) {
  toast.error(result.error.serverError ?? "Não foi possível agora. Tente de novo.");
}

/** Friendship with someone in the call; `null` while loading, and for guests (no account). */
export function useFriendRelation(userId: string | null) {
  const [relation, setRelation] = useState<FriendRelation | null>(null);
  useEffect(() => {
    if (userId === null) return;
    let active = true;
    async function load(id: string) {
      const result = await friendRelation({ userId: id });
      if (active && result.data) setRelation(result.data.relation);
    }
    void load(userId);
    return () => {
      active = false;
    };
  }, [userId]);

  const send = useOperation(sendFriendRequest, {
    onSuccess: ({ data }) => setRelation(data.status === "friends" ? "friends" : "sent"),
    onError: showError,
  });
  const answer = useOperation(answerFriendRequest, {
    onSuccess: () => setRelation("friends"),
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
