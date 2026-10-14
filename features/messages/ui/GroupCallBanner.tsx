import { useEffect } from "react";
import { Link, useRevalidator } from "react-router";
import { joinNames, firstName } from "@/features/messages/domain/conversation-display";
import { useNow } from "@/lib/hooks/use-now";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/Notice";

/** The banner checks again this often: a call that ends sends no message. */
const RECHECK_MS = 30_000;

export interface LiveGroupCall {
  roomCode: string;
  startedAt: Date;
  people: string[];
}

/** "Chamada em andamento · Bruno e Cecília · 12 min" with Entrar, for the group's members. */
export function GroupCallBanner({ call }: { call: LiveGroupCall }) {
  const now = useNow();
  const { revalidate } = useRevalidator();
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void revalidate();
    }, RECHECK_MS);
    return () => window.clearInterval(timer);
  }, [revalidate]);
  const minutes = Math.max(1, Math.round((now.getTime() - call.startedAt.getTime()) / 60_000));
  const people = joinNames(call.people.map(firstName));
  return (
    <Notice as="div" tone="success" className="mx-4 mt-3 gap-3 rounded-2xl py-2.5 pr-2.5 pl-4">
      <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-success" />
      <p className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">Chamada em andamento</span>
        <span className="block truncate text-xs text-ink-muted">
          {people} · {minutes} min
        </span>
      </p>
      <Button asChild className="h-9 text-sm font-semibold">
        <Link viewTransition to={`/sala/${call.roomCode}`}>
          Entrar
        </Link>
      </Button>
    </Notice>
  );
}
