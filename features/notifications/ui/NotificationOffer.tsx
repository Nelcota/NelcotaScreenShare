import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePermissionOffer } from "@/features/notifications/client/permission-offer";

/** "Receber avisos de mensagem e de chamada?", right below the top bar, until answered. */
export function NotificationOffer() {
  const offer = usePermissionOffer();
  if (!offer.visible) return null;
  return (
    <section
      aria-label="Avisos do navegador"
      className="fixed top-20 left-1/2 z-40 flex w-max max-w-[calc(100vw-1.5rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-2xl border border-line-strong bg-surface px-4 py-2.5 text-sm shadow-soft"
    >
      <span className="flex items-center gap-2">
        <BellRing className="size-4 shrink-0 text-brand-soft" aria-hidden="true" />
        Receber avisos de mensagem e de chamada?
      </span>
      <span className="flex items-center gap-1.5">
        <Button type="button" size="sm" onClick={offer.enable}>
          Ativar
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={offer.later}>
          Agora não
        </Button>
      </span>
    </section>
  );
}
