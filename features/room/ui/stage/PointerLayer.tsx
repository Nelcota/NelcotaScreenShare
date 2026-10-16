import { useDataChannel } from "@livekit/components-react";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type RefObject,
} from "react";
import { callToast as toast } from "@/features/room/client/call-notices";
import { useVideoContentBox } from "@/features/room/hooks/use-video-content-box";
import {
  createReceiveThrottle,
  decodeMessage,
  encodeMessage,
  pointerSchema,
  TOPICS,
  type PointerMessage,
} from "@/features/room/domain/data-channel";
import { participantName, SELF_LABEL } from "@/features/room/domain/participant-label";
import { moveCursor, type CursorPosition } from "@/features/room/domain/pointer-cursor";
import { useTimeouts } from "@/lib/hooks/use-timeouts";
import { logBrowserWarning } from "@/lib/telemetry.client";

/** Pointer on the shared screen: a dot that appears for everyone for a few seconds. */
interface Ping extends PointerMessage {
  id: number;
  name: string;
}

const PING_MS = 2500;
/** On screen at the same time: the oldest go first, so a flood does not freeze the stage. */
const MAX_PINGS = 20;
/** Minimum interval between points sent by this person. */
const SEND_INTERVAL_MS = 150;

export function usePointers() {
  const [pings, setPings] = useState<Ping[]>([]);
  const nextId = useRef(0);
  const lastSent = useRef(0);
  const later = useTimeouts();

  function add(point: PointerMessage, name: string) {
    const id = nextId.current++;
    setPings((list) => [...list.slice(-(MAX_PINGS - 1)), { ...point, id, name }]);
    later(() => setPings((list) => list.filter((ping) => ping.id !== id)), PING_MS);
  }

  const [acceptFrom] = useState(() => createReceiveThrottle(SEND_INTERVAL_MS / 2));

  const { send } = useDataChannel(TOPICS.pointer, (message) => {
    const sender = message.from?.identity;
    if (!sender || !acceptFrom(sender)) return;
    const received = decodeMessage(message.payload, pointerSchema);
    if (received) add(received, participantName(message.from));
  });

  function pointAt(message: PointerMessage) {
    const now = Date.now();
    if (now - lastSent.current < SEND_INTERVAL_MS) return;
    lastSent.current = now;
    add(message, SELF_LABEL);
    send(encodeMessage(message), { reliable: false }).catch((error: unknown) => {
      logBrowserWarning("Could not send the pointer", error);
      toast.error("Não foi possível marcar o ponto na tela.");
    });
  }

  return { pings, pointAt };
}

export function PointerLayer({
  videoRef,
  trackSid,
  pings,
  pointing,
  onPoint,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  trackSid: string;
  pings: Ping[];
  pointing: boolean;
  onPoint?: (message: PointerMessage) => void;
}) {
  const box = useVideoContentBox(videoRef);
  const layerRef = useRef<HTMLButtonElement>(null);
  // Keyboard cursor: starts in the middle and only shows on keyboard focus.
  const [cursor, setCursor] = useState<CursorPosition>({ x: 0.5, y: 0.5 });

  // Pointing turned on: focus goes to the image so the arrows work right away.
  useEffect(() => {
    if (pointing) layerRef.current?.focus({ preventScroll: true });
  }, [pointing]);

  if (!box) return null;

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    // Enter or Space (no pointer position): mark where the keyboard cursor is.
    if (event.detail === 0) {
      onPoint?.({ trackSid, ...cursor });
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    if (x >= 0 && x <= 1 && y >= 0 && y <= 1) onPoint?.({ trackSid, x, y });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const next = moveCursor(cursor, event.key, event.shiftKey);
    if (!next) return;
    event.preventDefault();
    setCursor(next);
  }

  const style = { left: box.left, top: box.top, width: box.width, height: box.height };
  const marks = <PingMarks pings={pings.filter((ping) => ping.trackSid === trackSid)} />;

  if (!pointing) {
    return (
      <div aria-hidden="true" className="pointer-events-none absolute" style={style}>
        {marks}
      </div>
    );
  }

  return (
    <button
      ref={layerRef}
      type="button"
      aria-label="Tela compartilhada. Use as setas para mover o ponto e Enter para marcar."
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="group/pointer absolute cursor-crosshair outline-none"
      style={style}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute hidden size-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-brand bg-brand/20 group-focus-visible/pointer:block"
        style={{ left: `${cursor.x * 100}%`, top: `${cursor.y * 100}%` }}
      />
      <span aria-hidden="true">{marks}</span>
    </button>
  );
}

function PingMarks({ pings }: { pings: Ping[] }) {
  return (
    <>
      {pings.map((ping) => (
        <span
          key={ping.id}
          className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
          style={{ left: `${ping.x * 100}%`, top: `${ping.y * 100}%` }}
        >
          <span className="relative flex size-5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-75 motion-reduce:animate-none" />
            <span className="relative inline-flex size-5 rounded-full border-2 border-canvas bg-brand" />
          </span>
          <span className="glass rounded-md px-1.5 py-0.5 text-xs font-medium whitespace-nowrap">
            {ping.name}
          </span>
        </span>
      ))}
    </>
  );
}
