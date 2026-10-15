import { pageSlotRef } from "@/lib/page-slot";
import { ArrowLeft, ArrowRight, Headphones, Ticket } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Mascot } from "@/features/mascot/ui/Mascot";
import type { RoomPresence } from "@/features/room/domain/presence";
import type { MicSetupState } from "@/features/room/hooks/use-mic-setup";
import { ShareSupportNote } from "@/features/room/ui/ShareSupportNote";
import { InviteLinkButton } from "./InviteLinkButton";
import { PresenceLine } from "./PresenceLine";
import { startPath } from "@/features/room/domain/start-path";
import { useStreamerMode } from "@/features/room/hooks/use-streamer-mode";

/** "Daily do time · abc-defg-hij", or "Sala abc-defg-hij"; streamer mode hides the code. */
function RoomLine({
  code,
  name,
  hideCode,
}: {
  code: string;
  name: string | null;
  hideCode: boolean;
}) {
  if (name && hideCode) return <p className="text-sm font-medium wrap-anywhere text-ink">{name}</p>;
  if (hideCode) return null;
  return (
    <p className="text-sm text-ink-muted">
      {name ? <span className="font-medium text-ink">{name} · </span> : "Sala "}
      <span translate="no" className="font-sans font-medium text-ink tabular-nums">
        {code}
      </span>
    </p>
  );
}

/** Mascot, title, room name and code, presence and the invite badge. */
export function PreJoinHeader({
  code,
  roomName,
  invite,
  presence,
  maxParticipants,
  guest,
  mic,
  submitting,
}: {
  code: string;
  roomName: string | null;
  invite?: string;
  presence: RoomPresence | null;
  maxParticipants: number;
  guest: boolean;
  mic: MicSetupState;
  submitting: boolean;
}) {
  const { enabled: streamerMode } = useStreamerMode();
  return (
    <header data-anim="row" className="flex w-full flex-col items-center gap-2 text-center">
      <Mascot
        className="size-20 sm:size-24"
        sizes="(min-width: 640px) 288px, 240px"
        canSleep={!mic.testing && !submitting}
        activity={submitting ? "waiting" : mic.testing ? "listening" : "idle"}
        voiceLevelRef={mic.levelRef}
      />
      <div className="flex flex-col items-center gap-2">
        {/* Other features show a short notice here, e.g. who will be called on joining. */}
        <div id="pre-join-notice" ref={pageSlotRef("pre-join-notice")} className="empty:hidden" />
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Tudo certo para entrar?
        </h1>
        <div className="flex max-w-full flex-wrap items-center justify-center gap-x-2 gap-y-1">
          <RoomLine code={code} name={roomName} hideCode={streamerMode} />
          <InviteLinkButton code={code} />
        </div>
        <PresenceLine presence={presence} max={maxParticipants} guest={guest} />
        {invite ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand/10 px-3.5 py-1.5 text-sm font-medium text-ink">
            <Ticket className="size-3.5 text-brand-soft" aria-hidden="true" />
            Com convite, sem senha
          </span>
        ) : null}
      </div>
    </header>
  );
}

/** Join button, the way back home and the tips below them. */
export function JoinActions({
  mic,
  submitting,
  joinDisabled,
  onPrepareJoin,
  signedIn,
}: {
  mic: MicSetupState;
  submitting: boolean;
  joinDisabled: boolean;
  onPrepareJoin?: () => void;
  signedIn: boolean;
}) {
  return (
    <div data-anim="row" className="flex w-full flex-col items-center gap-2.5">
      <Button
        type="submit"
        size="lg"
        disabled={joinDisabled}
        loading={submitting}
        onMouseEnter={onPrepareJoin}
        onFocus={onPrepareJoin}
        className="h-12! w-full"
      >
        {submitting ? "Entrando…" : mic.joinsMuted ? "Entrar só ouvindo" : "Entrar na sala"}
        {submitting ? null : <ArrowRight className="icon-nudge" aria-hidden="true" />}
      </Button>
      <Link
        viewTransition
        to={startPath(signedIn)}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Voltar ao início
      </Link>
      <div className="mt-2 flex flex-col items-center gap-1 text-center text-sm text-ink-muted">
        {mic.enabled ? (
          <p className="inline-flex items-center gap-1.5">
            <Headphones className="size-3.5 shrink-0" aria-hidden="true" />
            Use fones de ouvido para evitar eco.
          </p>
        ) : null}
        <ShareSupportNote variant="prejoin" />
      </div>
    </div>
  );
}
