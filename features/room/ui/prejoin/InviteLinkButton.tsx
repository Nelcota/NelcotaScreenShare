import { useStreamerMode } from "@/features/room/hooks/use-streamer-mode";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { roomUrl, useCopyRoomLink } from "@/features/room/hooks/use-copy-room-link";
import { cn } from "@/lib/utils";

/** Copies the invite; without clipboard access, shows the link to copy by hand. */
export function InviteLinkButton({ code }: { code: string }) {
  const [manual, setManual] = useState(false);
  const { copied, copy } = useCopyRoomLink(code, () => setManual(true));

  const { enabled: streamerMode } = useStreamerMode();
  if (streamerMode) return null;

  if (manual) {
    return (
      <p className="w-full text-center text-sm text-ink-muted">
        Copie e mande para o time:{" "}
        <span className="font-sans font-medium break-all text-ink tabular-nums select-all">
          {roomUrl(code)}
        </span>
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-live="polite"
      className={cn(
        "inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition-colors",
        copied ? "bg-success/10 text-success" : "text-brand-soft hover:bg-surface-2",
      )}
    >
      {copied ? (
        <Check className="icon-pop size-4" aria-hidden="true" />
      ) : (
        <Copy className="size-4" aria-hidden="true" />
      )}
      {copied ? "Link copiado" : "Copiar convite"}
    </button>
  );
}
