import type { ReactNode } from "react";
import { InviteCard } from "./InviteCard";

/** First to arrive, or the last one left after the others went. */
function aloneTitle(everyoneLeft: boolean): string {
  if (everyoneLeft) return "Todo mundo saiu da sala";
  return "Você é a primeira pessoa aqui";
}

/**
 * Alone in the room: your own tile, at the size it keeps with company, and a small invite
 * near the dock. When someone arrives the invite leaves and the tiles take the space.
 * Sharing the screen stays in the dock.
 */
export function AloneWelcome({
  code,
  tile,
  everyoneLeft,
}: {
  code: string;
  /** The local person's tile. */
  tile: ReactNode;
  /** Others were in the call and left: being alone is not the same as arriving first. */
  everyoneLeft: boolean;
}) {
  return (
    <section
      data-flip-id="alone"
      aria-labelledby="alone-title"
      className="flex min-h-0 w-full max-w-md flex-1 flex-col items-center justify-between gap-6"
    >
      <div className="flex w-full flex-1 flex-col items-center justify-center gap-4">
        <div className="w-full">{tile}</div>
        <h1 id="alone-title" className="text-base font-medium text-ink-muted">
          {aloneTitle(everyoneLeft)}
        </h1>
        {/* Other features add a line here, e.g. who is being called. */}
        <div id="room-call-status" className="empty:hidden" />
      </div>
      <InviteCard code={code} />
    </section>
  );
}
