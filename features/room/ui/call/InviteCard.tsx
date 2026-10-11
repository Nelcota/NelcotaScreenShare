import { Check, Copy } from "lucide-react";
import { useStreamerMode } from "@/features/room/hooks/use-streamer-mode";
import { useId, useRef } from "react";
import { QrCode } from "@/components/QrCode";
import { Button } from "@/components/ui/button";
import { roomPath } from "@/features/room/domain/room-code";
import { roomUrl, useCopyRoomLink } from "@/features/room/hooks/use-copy-room-link";

/**
 * Empty room invite: the link in plain sight (the person sees what they are copying), the
 * copy button and, on desktop, a QR code to join from a phone.
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
    return (
      <p className="text-sm text-ink-muted">
        Convites ocultos pelo modo streamer. Você ainda pode copiar o link pelo botão da sala.
      </p>
    );
  }

  return (
    <section
      aria-labelledby={titleId}
      className="flex w-full items-center gap-5 rounded-2xl border border-line bg-surface p-4 text-left sm:p-5"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div>
          <h2 id={titleId} className="text-base font-semibold">
            Convide o time
          </h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            Mande o link<span className="max-sm:hidden"> ou aponte a câmera do celular</span>.
          </p>
        </div>
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
            className="h-10 min-w-0 flex-1 truncate rounded-xl border border-line bg-surface-2 px-3 font-sans text-sm text-ink tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <Button
            type="button"
            variant="outline"
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
      </div>
      <div className="shrink-0 max-sm:hidden">
        <QrCode value={url} label="QR code para entrar na sala pelo celular" size={104} />
      </div>
    </section>
  );
}
