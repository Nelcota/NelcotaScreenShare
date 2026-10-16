import { useEffect, useState } from "react";
import { callToast as toast } from "@/features/room/client/call-notices";
import { answerJoin, joinRequests } from "@/features/room/actions";
import { managesRoomAccess } from "@/features/room/domain/room-access";
import { useLocalRoomRole } from "@/features/room/hooks/use-room-roles";
import { useOperation } from "@/lib/operations/use-operation";
import { logBrowserWarning } from "@/lib/telemetry.client";
import { InitialsAvatar } from "@/components/InitialsAvatar";
import { Button } from "@/components/ui/button";

interface Request {
  id: string;
  name: string;
  guest: boolean;
}

const CHECK_EVERY_MS = 3000;
const SHOWN = 3;

/** Polls the waiting requests while this person manages the room. */
function usePendingRequests(code: string) {
  const canManage = managesRoomAccess(useLocalRoomRole());
  const [requests, setRequests] = useState<Request[]>([]);
  useEffect(() => {
    if (!canManage) return;
    let active = true;
    let timer: number | undefined;
    async function poll() {
      try {
        const result = await joinRequests({ room: code });
        if (active) setRequests(result.data?.requests ?? []);
      } catch (error) {
        // A dropped connection must not stop the checks: the next one tries again.
        logBrowserWarning("Join requests check failed", error);
      } finally {
        if (active) timer = window.setTimeout(() => void poll(), CHECK_EVERY_MS);
      }
    }
    void poll();
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [code, canManage]);
  return {
    requests: canManage ? requests : [],
    drop: (id: string) => setRequests((all) => all.filter((r) => r.id !== id)),
  };
}

function RequestCard({
  code,
  request,
  onAnswered,
}: {
  code: string;
  request: Request;
  onAnswered: (id: string) => void;
}) {
  const answer = useOperation(answerJoin, {
    onSuccess: () => onAnswered(request.id),
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Não foi possível responder agora.");
      onAnswered(request.id);
    },
  });
  return (
    <li className="glass flex flex-col gap-3 rounded-2xl p-3">
      <div className="flex items-center gap-3">
        <InitialsAvatar
          name={request.name}
          source={null}
          className="size-10 shrink-0 bg-brand/15 text-sm font-medium text-brand-soft"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-medium">{request.name}</span>
          <span className="block truncate text-sm text-ink-muted">
            {request.guest ? "Convidado quer entrar" : "Quer entrar"}
          </span>
        </span>
      </div>
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="quiet"
          disabled={answer.isPending}
          onClick={() => answer.execute({ room: code, requestId: request.id, accept: false })}
          className="h-9 px-3 text-sm"
        >
          Recusar
        </Button>
        <Button
          type="button"
          disabled={answer.isPending}
          onClick={() => answer.execute({ room: code, requestId: request.id, accept: true })}
          className="h-9 text-sm"
        >
          Aceitar
        </Button>
      </div>
    </li>
  );
}

/** People asking to enter, for the owner and moderators; nothing for everyone else. */
export function JoinRequests({ code }: { code: string }) {
  const { requests, drop } = usePendingRequests(code);
  if (requests.length === 0) return null;
  const hidden = requests.length - SHOWN;
  return (
    <section
      aria-label="Pedidos para entrar"
      className="pointer-events-auto fixed top-20 right-3 z-30 w-[min(22rem,calc(100vw-1.5rem))] sm:right-6"
    >
      <ul className="flex flex-col gap-2">
        {requests.slice(0, SHOWN).map((request) => (
          <RequestCard key={request.id} code={code} request={request} onAnswered={drop} />
        ))}
      </ul>
      {hidden > 0 ? (
        <p className="mt-2 text-right text-sm text-ink-muted">
          {hidden === 1 ? "Mais 1 pessoa esperando" : `Mais ${hidden} pessoas esperando`}
        </p>
      ) : null}
    </section>
  );
}
