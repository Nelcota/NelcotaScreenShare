import { Monitor } from "lucide-react";
import { useState } from "react";
import { useOperation } from "@/lib/operations/use-operation";
import { toast } from "sonner";
import type { revokeMyOtherSessions, revokeMySession } from "@/features/account/actions";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { sessionEndConfirmation, type SessionEnd } from "@/features/security/domain/session-end";
import { cn } from "@/lib/utils";
import { formatDateTime, formatRelative } from "@/lib/format";
import { describeUserAgent } from "@/lib/user-agent";

function revokedMessage(count: number): string {
  if (count === 0) return "Não havia outras sessões.";
  if (count === 1) return "1 sessão encerrada.";
  return `${count} sessões encerradas.`;
}

interface SessionRow {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Sessions of the user's own account. The actions come via prop (the participant
 * page passes its own; the panel, the admin ones): the list knows neither.
 */
export function SessionList({
  sessions,
  currentId,
  revokeSession,
  revokeOtherSessions,
  variant = "card",
}: {
  sessions: SessionRow[];
  currentId: string;
  revokeSession: typeof revokeMySession;
  revokeOtherSessions: typeof revokeMyOtherSessions;
  /** `plain`: no card of its own, for callers already inside one (e.g. /conta). */
  variant?: "card" | "plain";
}) {
  const plain = variant === "plain";
  // Ending sessions signs devices out: it asks first.
  const [ending, setEnding] = useState<SessionEnd | null>(null);
  const revokeOne = useOperation(revokeSession, {
    onSuccess: () => {
      setEnding(null);
      toast.success("Sessão encerrada.");
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Não foi possível encerrar."),
  });
  const revokeOthers = useOperation(revokeOtherSessions, {
    onSuccess: ({ data }) => {
      setEnding(null);
      toast.success(revokedMessage(data.revoked));
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Não foi possível encerrar."),
  });
  const others = sessions.filter((session) => session.id !== currentId).length;
  const confirmEnd = (end: SessionEnd) => {
    if (end.kind === "one") return revokeOne.execute({ sessionId: end.sessionId });
    revokeOthers.execute();
  };

  return (
    <section
      className={plain ? undefined : "panel rounded-2xl p-2 sm:p-3"}
      aria-label="Lista de sessões"
    >
      <ul className="flex flex-col">
        {sessions.map((session) => {
          const current = session.id === currentId;
          return (
            <li
              key={session.id}
              className={cn(
                "flex flex-wrap items-center gap-3 py-3 [&+&]:border-t [&+&]:border-line",
                plain ? "px-0" : "rounded-xl px-3",
              )}
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2">
                <Monitor className="size-5 text-brand-soft" aria-hidden="true" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-2 font-medium">
                  {describeUserAgent(session.userAgent)}
                  {current ? (
                    <span className="rounded-md bg-brand px-1.5 py-0.5 text-xs font-semibold text-brand-ink">
                      Este dispositivo
                    </span>
                  ) : null}
                </span>
                <span className="text-sm [overflow-wrap:anywhere] text-ink-muted">
                  {session.ipAddress ?? "IP desconhecido"} · entrou em{" "}
                  {formatDateTime(session.createdAt)} · ativo{" "}
                  <time dateTime={session.updatedAt} suppressHydrationWarning>
                    {formatRelative(session.updatedAt)}
                  </time>
                </span>
              </span>
              {current ? null : (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={revokeOne.isPending}
                  onClick={() =>
                    setEnding({
                      kind: "one",
                      sessionId: session.id,
                      device: describeUserAgent(session.userAgent),
                    })
                  }
                >
                  Encerrar
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {others > 0 ? (
        <div
          className={cn(
            "flex justify-end border-t border-line pt-3 pb-1",
            plain ? "px-0 pb-2" : "px-3",
          )}
        >
          <Button
            variant="outline"
            loading={revokeOthers.isPending}
            onClick={() => setEnding({ kind: "others", count: others })}
          >
            Encerrar todas as outras
          </Button>
        </div>
      ) : null}
      {ending ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setEnding(null);
          }}
          {...sessionEndConfirmation(ending)}
          pending={revokeOne.isPending || revokeOthers.isPending}
          onConfirm={() => confirmEnd(ending)}
        />
      ) : null}
    </section>
  );
}
