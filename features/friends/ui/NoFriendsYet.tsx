import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { copyFriendCode } from "@/features/friends/client/copy-friend-code";

/** An empty friends list: your code right there, ready to copy and hand out. */
export function NoFriendsYet({ code }: { code: string }) {
  return (
    <div className="flex flex-col gap-2 px-3 py-4 text-sm text-ink-muted">
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
