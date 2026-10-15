import { Copy } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { copyFriendCode } from "@/features/friends/client/copy-friend-code";

function requestsLine(count: number) {
  return count === 1 ? "Você tem 1 pedido de amizade." : `Você tem ${count} pedidos de amizade.`;
}

/**
 * An empty friends list: your code right there, ready to copy and hand out, and the
 * requests that came in, when there are any.
 */
export function NoFriendsYet({ code, requests = 0 }: { code: string; requests?: number }) {
  return (
    <div className="flex flex-col gap-2 px-3 py-4 text-sm text-ink-muted">
      {requests > 0 ? (
        <Link to="/amigos/pedidos" viewTransition className="font-medium text-brand-soft underline">
          {requestsLine(requests)}
        </Link>
      ) : null}
      <p>Você ainda não tem amigos aqui. Passe seu código para alguém:</p>
      <div className="flex items-center gap-2 rounded-xl bg-surface-2 py-1.5 pr-1.5 pl-3">
        <span className="min-w-0 flex-1 truncate font-mono font-semibold tracking-wider text-ink">
          {code}
        </span>
        <Button size="sm" variant="ghost" onClick={() => void copyFriendCode(code)}>
          <Copy aria-hidden="true" />
          Copiar
        </Button>
      </div>
    </div>
  );
}
