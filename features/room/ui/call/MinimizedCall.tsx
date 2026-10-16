import { useRef } from "react";
import { useNavigate } from "react-router";
import { NavDivider } from "@/components/shell/NavBar";
import { roomPath } from "@/features/room/domain/room-code";
import { useDraggableCard } from "@/features/room/hooks/use-draggable-card";
import { useIsMobile } from "@/lib/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  BackToRoomLink,
  CallConnectionDot,
  CallDeafenButton,
  CallSpeakers,
  CallLeaveButton,
  CallMicButton,
  CallStopShareButton,
} from "./CallControls";

/** A phone has room for two faces next to the controls. */
const PHONE_FACES = 2;

/**
 * Floating card while the call goes on behind a page outside the room: who is in it, who
 * speaks, the microphone, the room's sound, sharing, leaving and the way back. It can be
 * dragged anywhere on screen and stays there; on phones it sits at the bottom. No room
 * code: it may be on stream.
 */
export function MinimizedCall({ code, onLeave }: { code: string; onLeave: () => void }) {
  const cardRef = useRef<HTMLElement>(null);
  const mobile = useIsMobile();
  const navigate = useNavigate();
  // The faces are the biggest target: a tap there goes back, a drag only moves the card.
  // Keyboard and screen readers use "Voltar à chamada".
  const drag = useDraggableCard(cardRef, !mobile, (target) => {
    if (!(target instanceof Element) || !target.closest("[data-back-to-call]")) return;
    void navigate(roomPath(code), { viewTransition: true });
  });

  return (
    <aside
      ref={cardRef}
      aria-label="Chamada em andamento"
      // Focusable to move it with the arrows (Home: back to the corner).
      tabIndex={mobile ? undefined : 0}
      aria-keyshortcuts={mobile ? undefined : "ArrowUp ArrowDown ArrowLeft ArrowRight Home"}
      style={drag.style}
      {...drag.handlers}
      className={cn(
        "glass fixed z-50 flex items-center gap-2 rounded-2xl p-2",
        "max-md:inset-x-2 max-md:bottom-[max(0.5rem,env(safe-area-inset-bottom))] max-md:justify-between",
        // Bottom right, above a page's composer (messages) and clear of its header.
        "md:right-4 md:bottom-24 md:cursor-grab md:touch-none md:select-none",
        "outline-none focus-visible:ring-3 focus-visible:ring-brand-soft",
        drag.dragging && "md:cursor-grabbing",
      )}
    >
      <span
        data-back-to-call=""
        className="flex min-w-0 cursor-pointer items-center gap-2 rounded-xl py-0.5 pr-2 transition-colors hover:bg-surface-2"
      >
        <CallConnectionDot className="ml-1" />
        <CallSpeakers roomCode={code} max={mobile ? PHONE_FACES : undefined} />
      </span>
      <NavDivider className="mx-0 max-md:hidden" />
      <span className="flex items-center gap-1">
        <CallMicButton />
        <CallDeafenButton />
        <CallStopShareButton />
        <BackToRoomLink code={code} />
        <CallLeaveButton onLeave={onLeave} />
      </span>
    </aside>
  );
}
