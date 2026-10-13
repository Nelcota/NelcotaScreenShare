import { useEffect, useState } from "react";
import { toast } from "sonner";
import { answerFriendRequest, friendRelation, sendFriendRequest } from "@/features/friends/actions";
import type { FriendRelation } from "@/features/friends/domain/friend-lists";
import { useOperation } from "@/lib/operations/use-operation";

const BUTTON =
  "flex h-11 items-center justify-center gap-2 rounded-xl bg-brand text-base font-medium text-brand-ink transition-colors hover:bg-brand-hover disabled:opacity-60";

function showError(result: { error: { serverError?: string } }) {
  toast.error(result.error.serverError ?? "Não foi possível agora. Tente de novo.");
}

/** Friendship with someone in the call, from their card. Guests and visitors see nothing. */
export function CardFriendButton({ userId }: { userId: string }) {
  const [relation, setRelation] = useState<FriendRelation | null>(null);
  useEffect(() => {
    let active = true;
    async function load() {
      const result = await friendRelation({ userId });
      if (active && result.data) setRelation(result.data.relation);
    }
    void load();
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

  if (relation === "friends") return <p className="text-center text-sm text-ink-muted">Amigos</p>;
  if (relation === "sent") {
    return <p className="text-center text-sm text-ink-muted">Pedido de amizade enviado</p>;
  }
  if (relation === "received") {
    return (
      <button
        type="button"
        disabled={answer.isPending}
        onClick={() => answer.execute({ userId, accept: true })}
        className={BUTTON}
      >
        Aceitar pedido de amizade
      </button>
    );
  }
  if (relation !== "none") return null;
  return (
    <button
      type="button"
      disabled={send.isPending}
      onClick={() => send.execute({ userId })}
      className={BUTTON}
    >
      Adicionar amigo
    </button>
  );
}
