import { useIsSpeaking, useParticipantAttribute } from "@livekit/components-react";
import type { Participant } from "livekit-client";
import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { isGuestIdentity } from "@/features/room/domain/participant-label";
import { useParticipantName } from "@/features/room/hooks/use-participant-name";
import { parseRoomRole, ROLE_ATTRIBUTE, type RoomRole } from "@/features/room/domain/room-role";
import type { FriendRelation } from "@/features/friends/domain/friend-lists";
import { useIsMobile } from "@/lib/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { CardFriendItem, useFriendRelation } from "./CardFriendButton";
import { MuteAllItem, VoiceLine } from "./CardListening";
import { CardModeration } from "./CardModeration";
import { CardRoles } from "./CardRoles";
import { CardReportButton } from "./CardReportButton";
import { ParticipantAvatar } from "./ParticipantAvatar";

interface CardProps {
  participant: Participant;
  roomCode: string;
}

/** Dragging the sheet down this far closes it. */
const CLOSE_DRAG = 80;

const ROLE_WORDS: Partial<Record<RoomRole, string>> = { owner: "Dono", moderator: "Moderador" };

/**
 * The quiet line under the name: "Dono · Amigo", "Você", or "Convidado" for someone without
 * an account. An ordinary participant who is no friend has none.
 */
function cardMeta(
  participant: Participant,
  role: RoomRole,
  relation: FriendRelation | null,
): string | null {
  const words = [participant.isLocal ? "Você" : null, ROLE_WORDS[role] ?? null];
  if (isGuestIdentity(participant.identity)) words.push("Convidado");
  if (relation === "friends") words.push("Amigo");
  const shown = words.filter((word): word is string => word !== null);
  return shown.length > 0 ? shown.join(" · ") : null;
}

function CardHeader({
  participant,
  roomCode,
  title,
  meta,
}: CardProps & { title: ReactNode; meta: string | null }) {
  const isSpeaking = useIsSpeaking(participant);
  return (
    <div className="flex items-center gap-2.5 px-2 pt-1.5 pb-1">
      <ParticipantAvatar
        participant={participant}
        roomCode={roomCode}
        className={cn(
          "size-10 shrink-0 bg-surface-3 text-sm font-medium text-ink ring-1 ring-line transition-shadow",
          isSpeaking && "ring-2 ring-brand-soft",
        )}
      />
      <div className="min-w-0">
        {title}
        {meta ? <p className="truncate text-sm text-ink-muted">{meta}</p> : null}
      </div>
    </div>
  );
}

/**
 * Compact card: who it is, the voice for me in one line, then the actions as menu items.
 * The tile already shows the microphone, the hand and the shared screen.
 */
function CardBody({
  participant,
  roomCode,
  title,
  onClose,
}: CardProps & { title: ReactNode; onClose: () => void }) {
  const { plain } = useParticipantName(participant);
  const account = !participant.isLocal && !isGuestIdentity(participant.identity);
  const friendship = useFriendRelation(account ? participant.identity : null);
  const role = parseRoomRole(useParticipantAttribute(ROLE_ATTRIBUTE, { participant }));
  return (
    <div className="flex flex-col gap-1">
      <CardHeader
        participant={participant}
        roomCode={roomCode}
        title={title}
        meta={cardMeta(participant, role, friendship.relation)}
      />
      {participant.isLocal ? null : (
        <>
          <VoiceLine participant={participant} />
          <hr className="mx-1 my-1 border-line" />
          <MuteAllItem participant={participant} />
        </>
      )}
      {account ? <CardFriendItem userId={participant.identity} friendship={friendship} /> : null}
      <CardRoles participant={participant} roomCode={roomCode} />
      {account ? <CardReportButton userId={participant.identity} name={plain} /> : null}
      <CardModeration participant={participant} roomCode={roomCode} onRemoved={onClose} />
    </div>
  );
}

const NAME_CLASS = "truncate text-base font-semibold tracking-tight";

function CardPopover({ children, ...props }: CardProps & { children: ReactNode }) {
  const { plain } = useParticipantName(props.participant);
  const [open, setOpen] = useState(false);
  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>{children}</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          // Held to the tile: beside the photo, from its top, inside the tile where it fits.
          side="right"
          align="start"
          sideOffset={12}
          // The dock stays clear: without room below, the card opens upward.
          collisionPadding={{ top: 16, right: 16, left: 16, bottom: 128 }}
          aria-label={plain}
          className="z-50 w-72 rounded-2xl border border-line-strong bg-surface-3 p-1.5 shadow-soft outline-none"
        >
          <CardBody
            {...props}
            onClose={() => setOpen(false)}
            title={<p className={NAME_CLASS}>{plain}</p>}
          />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

/** Phone: a sheet from the bottom with a handle; dragging it down closes it. */
function CardSheet({ children, ...props }: CardProps & { children: ReactNode }) {
  const { plain } = useParticipantName(props.participant);
  const [open, setOpen] = useState(false);
  const [drag, setDrag] = useState(0);
  const start = useRef<number | null>(null);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    start.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (start.current === null) return;
    setDrag(Math.max(0, event.clientY - start.current));
  }
  function onPointerUp() {
    start.current = null;
    if (drag > CLOSE_DRAG) setOpen(false);
    setDrag(0);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        aria-describedby={undefined}
        style={drag > 0 ? { transform: `translateY(${drag}px)` } : undefined}
        className={cn(
          "gap-0 rounded-t-3xl border-line bg-surface px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-ink outline-none",
          // While the finger drags, the sheet follows it without easing.
          drag > 0 && "transition-none",
        )}
      >
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="flex touch-none justify-center pt-3 pb-4"
        >
          <span aria-hidden="true" className="h-1.5 w-10 rounded-full bg-line-strong" />
        </div>
        <CardBody
          {...props}
          onClose={() => setOpen(false)}
          title={<SheetTitle className={cn(NAME_CLASS, "text-ink")}>{plain}</SheetTitle>}
        />
      </SheetContent>
    </Sheet>
  );
}

/**
 * Tapping someone's photo in the call opens their card: who they are, what they are doing
 * and, for the others, a volume only for me.
 */
export function ParticipantCard({
  children,
  className,
  ...props
}: CardProps & { children: ReactNode; className?: string }) {
  const { plain } = useParticipantName(props.participant);
  const isMobile = useIsMobile();
  const trigger = (
    <button
      type="button"
      aria-label={`Ver ${plain}`}
      className={cn(
        "rounded-full outline-none focus-visible:ring-3 focus-visible:ring-brand-soft",
        className,
      )}
    >
      {children}
    </button>
  );
  if (isMobile) return <CardSheet {...props}>{trigger}</CardSheet>;
  return <CardPopover {...props}>{trigger}</CardPopover>;
}
