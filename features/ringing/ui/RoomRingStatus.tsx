import { PhoneOutgoing } from "lucide-react";
import { createPortal } from "react-dom";
import { useLocation, useRouteLoaderData } from "react-router";
import type { loader as rootLoader } from "@/app/root";
import { Button } from "@/components/ui/button";
import { cancelCalling } from "@/features/ringing/client/calling";
import { usePageSlot } from "@/features/ringing/client/use-page-slot";
import { ringStatusLine } from "@/features/ringing/domain/ring";

/** The spot under "Você é a primeira pessoa aqui" that the room keeps for this line. */
const STATUS_SLOT_ID = "room-call-status";

/**
 * Alone in the room after "Chamar": who is being called, with Cancelar, and then how it
 * ended. Without it the screen only said you were alone and suggested calling again.
 */
export function RoomRingStatus() {
  const { pathname } = useLocation();
  const outgoing = useRouteLoaderData<typeof rootLoader>("root")?.ringing?.outgoing ?? [];
  const line = ringStatusLine(outgoing);
  const slot = usePageSlot(STATUS_SLOT_ID, pathname.startsWith("/sala/") && line !== null);
  if (!slot || !line) return null;
  return createPortal(
    <output className="flex items-center gap-2 text-sm text-ink-muted" aria-live="polite">
      <PhoneOutgoing className="size-4 shrink-0 text-brand-soft" aria-hidden="true" />
      {line.text}
      {line.cancel ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            if (line.cancel) cancelCalling(line.cancel.calleeId, line.cancel.ringId);
          }}
        >
          Cancelar
        </Button>
      ) : null}
    </output>,
    slot,
  );
}
