import { Loader2, MonitorUp } from "lucide-react";
import { Popover } from "radix-ui";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Mascot } from "@/features/mascot/ui/Mascot";
import { canShare } from "@/features/room/domain/share-support";
import type { ScreenShareControl } from "@/features/room/hooks/use-screen-share";
import { useShareSupport } from "@/features/room/hooks/use-share-support";
import { DockPopoverContent } from "@/features/room/ui/dock/DockPopover";
import { SharePanel } from "@/features/room/ui/dock/SharePanel";
import { InviteCard } from "./InviteCard";

/** Same choices as the dock (surface and audio), opened from the big button. */
function ShareButton({ share }: { share: ScreenShareControl }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button size="lg" disabled={share.busy}>
          {share.busy ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <MonitorUp aria-hidden="true" />
          )}
          Compartilhar minha tela
        </Button>
      </Popover.Trigger>
      <DockPopoverContent
        side="bottom"
        aria-label="Opções de compartilhamento"
        className="w-[min(22rem,calc(100vw-2rem))] text-left"
      >
        <SharePanel
          audio={share.audio}
          onAudioChange={share.setAudio}
          onPick={(choice) => {
            setOpen(false);
            void share.start(choice);
          }}
        />
      </DockPopoverContent>
    </Popover.Root>
  );
}

/** Heading and subtitle: first to arrive, or the last one left after the others went. */
function aloneCopy(everyoneLeft: boolean, shareSupported: boolean) {
  if (everyoneLeft) {
    return {
      title: "Todo mundo saiu da sala",
      subtitle: shareSupported
        ? "Chame o time de volta ou mostre sua tela enquanto espera."
        : "Chame o time de volta pelo convite abaixo.",
    };
  }
  return {
    title: "Você é a primeira pessoa aqui",
    subtitle: shareSupported
      ? "Mostre sua tela ou chame o time para entrar."
      : "Chame o time para entrar. Para mostrar sua tela, use o Chrome, Edge ou Firefox no computador.",
  };
}

/** Actions available while the person is alone in the room. */
export function AloneWelcome({
  code,
  share,
  everyoneLeft,
}: {
  code: string;
  share: ScreenShareControl;
  /** Others were in the call and left: being alone is not the same as arriving first. */
  everyoneLeft: boolean;
}) {
  const shareSupport = useShareSupport();
  const shareSupported = shareSupport !== null && canShare(shareSupport);
  const copy = aloneCopy(everyoneLeft, shareSupported);

  return (
    <section
      data-flip-id="alone"
      aria-labelledby="alone-title"
      className="flex max-w-lg flex-col items-center gap-5 text-center"
    >
      <Mascot className="size-28" sizes="336px" canSleep={false} />
      <div className="flex flex-col gap-2">
        <h1 id="alone-title" className="text-3xl font-semibold tracking-[-0.025em] text-balance">
          {copy.title}
        </h1>
        <p className="text-lg text-pretty text-ink-muted">{copy.subtitle}</p>
      </div>
      {shareSupported ? <ShareButton share={share} /> : null}
      <InviteCard code={code} />
    </section>
  );
}
