import { pageSlotRef } from "@/lib/page-slot";
import { Check, Copy } from "lucide-react";
import { useStreamerMode } from "@/features/room/hooks/use-streamer-mode";
import { useId, useRef } from "react";
import { QrCode } from "@/components/QrCode";
import { Button } from "@/components/ui/button";
import { roomPath } from "@/features/room/domain/room-code";
import { roomUrl, useCopyRoomLink } from "@/features/room/hooks/use-copy-room-link";

/**
 * Empty room invite, small and near the dock: the link in plain sight (the person sees what
 * they are copying), the copy button and, on desktop, a QR code to join from a phone.
 */
export function InviteCard({ code }: { code: string }) {
  const { enabled } = useStreamerMode();
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const url = roomUrl(code);
  const shown = `${window.location.host}${roomPath(code)}`;
  // No clipboard access: leaves the link selected to copy by hand.
  const { copied, copy } = useCopyRoomLink(code, () => {
    inputRef.current?.focus();
    inputRef.current?.select();
  });

  if (enabled) {
    return <p className="text-sm text-ink-muted">Convites ocultos pelo modo streamer.</p>;
  }

  return (
    <section
      aria-labelledby={titleId}
      className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface-2 p-3 text-left"
    >
      <div className="shrink-0 rounded-lg bg-white p-1 max-sm:hidden">
        <QrCode value={url} label="QR code para entrar na sala pelo celular" size={85} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <h2 id={titleId} className="text-sm font-semibold">
          Chamar pessoas
        </h2>
        <div className="flex min-w-0 gap-2">
          <label htmlFor={`${titleId}-link`} className="sr-only">
            Link da sala
          </label>
          <input
            ref={inputRef}
            id={`${titleId}-link`}
            readOnly
            value={shown}
            onFocus={(event) => event.currentTarget.select()}
            className="h-9 min-w-0 flex-1 truncate rounded-xl border border-line bg-surface px-3 font-sans text-sm text-ink tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <Button
            type="button"
            size="sm"
            onClick={() => void copy()}
            aria-live="polite"
            className="shrink-0"
          >
            {copied ? (
              <Check className="icon-pop text-success" aria-hidden="true" />
            ) : (
              <Copy aria-hidden="true" />
            )}
            {copied ? "Copiado" : "Copiar"}
          </Button>
        </div>
        {/* Other features add a way to invite here, e.g. ringing friends, on a row of its own. */}
        <div
          id="room-invite-actions"
          ref={pageSlotRef("room-invite-actions")}
          className="empty:hidden"
        />
      </div>
    </section>
  );
}
