import { MonitorOff, MonitorUp } from "lucide-react";
import { Popover } from "radix-ui";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useShortcut } from "@/lib/hooks/use-shortcut";
import { DockButton } from "./DockButton";
import { DockPopoverContent } from "./DockPopover";
import { SharePanel } from "./SharePanel";
import { canShare, shareSupportMessage } from "@/features/room/domain/share-support";
import type { ScreenShareControl } from "@/features/room/hooks/use-screen-share";
import { useShareSupport } from "@/features/room/hooks/use-share-support";

/** Seconds since `running` became true; resets to zero on stop. */
function useElapsedSeconds(running: boolean): number {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!running) return;
    const start = Date.now();
    const id = window.setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => {
      window.clearInterval(id);
      setSeconds(0);
    };
  }, [running]);
  return seconds;
}

function formatElapsed(total: number): string {
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, "0");
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}`
    : `${String(minutes).padStart(2, "0")}:${seconds}`;
}

/**
 * Our own menu before the native picker: the person chooses the surface type
 * and the browser picker opens on the matching tab (`displaySurface`).
 */
export function ShareMenu({ share }: { share: ScreenShareControl }) {
  const { isSharing, busy } = share;
  const support = useShareSupport();
  // Same rule as the notes before joining: phones and tablets watch, they do not share.
  const supported = support !== null && canShare(support);
  const [open, setOpen] = useState(false);
  // While sharing, the button shows for how long: makes it clear the screen is live.
  const elapsed = formatElapsed(useElapsedSeconds(isSharing));

  const sharingRestricted = !share.permitted && !isSharing;
  const label = shareButtonLabel(sharingRestricted, supported, isSharing, elapsed);

  function handleOpenChange(next: boolean) {
    if (next && sharingRestricted) {
      toast.info("O anfitrião restringiu o compartilhamento de tela.");
      return;
    }
    if (next && !supported) {
      toast.info(shareSupportMessage(support ?? "unsupported"));
      return;
    }
    // While sharing: the button stops immediately, without opening the menu.
    if (next && isSharing) {
      void share.stop();
      return;
    }
    setOpen(next);
  }

  // The key only opens the menu: one stray press must not take the screen off the air.
  useShortcut("s", () => handleOpenChange(!open), !busy && !isSharing);

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <DockButton
          label={label}
          // Neutral until it starts (green in the dock looks "on"); red to stop.
          tone={isSharing ? "muted" : "default"}
          caption={busy ? "Aguarde…" : isSharing ? `Parar · ${elapsed}` : "Compartilhar"}
          shortCaption={busy ? "…" : isSharing ? elapsed : "Tela"}
          pressed={isSharing}
          shortcut={isSharing ? undefined : "S"}
          aria-disabled={!supported || !share.permitted || undefined}
          disabled={busy}
          busy={busy}
          className="tabular-nums sm:min-w-24"
        >
          {isSharing ? (
            <MonitorOff className="size-5" aria-hidden="true" />
          ) : (
            <MonitorUp className="size-5" aria-hidden="true" />
          )}
        </DockButton>
      </Popover.Trigger>

      <DockPopoverContent
        aria-label="Opções de compartilhamento"
        className="max-h-[min(var(--radix-popover-content-available-height),calc(100dvh-2rem))] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain"
      >
        <SharePanel
          audio={share.audio}
          profile={share.profile}
          onAudioChange={share.setAudio}
          onProfileChange={share.setProfile}
          onPick={(choice) => {
            setOpen(false);
            void share.start(choice);
          }}
        />
      </DockPopoverContent>
    </Popover.Root>
  );
}

function shareButtonLabel(
  restricted: boolean,
  supported: boolean,
  sharing: boolean,
  elapsed: string,
) {
  if (restricted) return "Compartilhamento restrito pelo anfitrião";
  if (!supported) return "Compartilhar tela não é suportado neste navegador";
  if (sharing) return `Parar de compartilhar (no ar há ${elapsed})`;
  return "Compartilhar tela";
}
