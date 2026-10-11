import { useConnectionState, useLocalParticipant } from "@livekit/components-react";
import { ConnectionState } from "livekit-client";
import { ArrowLeft, HeadphoneOff, MicOff, MonitorUp } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { roomPath } from "@/features/room/domain/room-code";
import { useDeafen } from "@/features/room/ui/dock/Deafen";
import { cn } from "@/lib/utils";

/**
 * Floating card while the call goes on behind another page (the admin panel):
 * says the call is still open, whether the screen is being shared, and goes back.
 */
export function MinimizedCall({ code }: { code: string }) {
  const { isScreenShareEnabled, isMicrophoneEnabled } = useLocalParticipant();
  const connected = useConnectionState() === ConnectionState.Connected;
  const { deafened } = useDeafen();

  return (
    <aside
      aria-label="Chamada em andamento"
      className="glass fixed right-4 bottom-4 z-50 flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-2xl py-2 pr-2 pl-4"
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-2.5 shrink-0 rounded-full",
          connected ? "live-dot bg-success" : "animate-pulse bg-warning",
        )}
      />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium">
          {isScreenShareEnabled ? "Compartilhando sua tela" : "Em chamada"}
        </span>
        <span className="truncate text-xs text-ink-muted tabular-nums">Sala {code}</span>
      </span>
      {isScreenShareEnabled ? (
        <MonitorUp className="size-4 shrink-0 text-brand-soft" aria-hidden="true" />
      ) : null}
      {deafened ? (
        <span className="shrink-0 text-ink-muted">
          <HeadphoneOff className="size-4" aria-hidden="true" />
          <span className="sr-only">Som da sala desligado</span>
        </span>
      ) : null}
      {isMicrophoneEnabled ? null : (
        <span className="shrink-0 text-ink-muted">
          <MicOff className="size-4" aria-hidden="true" />
          <span className="sr-only">Microfone desligado</span>
        </span>
      )}
      <Button asChild size="lg">
        <Link viewTransition to={roomPath(code)}>
          <ArrowLeft aria-hidden="true" />
          Voltar à sala
        </Link>
      </Button>
    </aside>
  );
}
