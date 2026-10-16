import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
} from "react";
import { useLocation } from "react-router";
import {
  clearCardOffset,
  saveCardOffset,
  savedCardOffset,
} from "@/features/room/client/saved-card-position";
import {
  clampOffset,
  clearOfAreas,
  nudgeOffset,
  snapToCorner,
  type Area,
  type CardOffset,
} from "@/features/room/domain/card-position";
import { prefersReducedMotion } from "@/lib/animation/motion";

interface DragStart {
  pointerX: number;
  pointerY: number;
  offset: CardOffset;
  /** Where the press began: the capture sends every later event to the card itself. */
  target: EventTarget | null;
}

function viewport() {
  return { width: window.innerWidth, height: window.innerHeight };
}

function measure(card: HTMLElement) {
  const { width, height } = card.getBoundingClientRect();
  return { width, height };
}

function currentOffset(card: HTMLElement): CardOffset {
  const rect = card.getBoundingClientRect();
  return { right: window.innerWidth - rect.right, bottom: window.innerHeight - rect.bottom };
}

/** What the card must never cover, such as the start's room field (`data-call-card-clear`). */
function areasToKeepClear(): Area[] {
  return [...document.querySelectorAll("[data-call-card-clear]")].map((element) => {
    const { left, top, width, height } = element.getBoundingClientRect();
    return { left, top, width, height };
  });
}

/** Buttons and links inside the card keep working: only the card itself drags. */
function startsOnControl(target: EventTarget): boolean {
  return target instanceof Element && target.closest("button, a") !== null;
}

/** A press that moves less than this, in pixels, is still a click. */
const CLICK_SLOP = 4;
/** How long the dropped card takes to slide into its corner. */
const SNAP_MS = 200;

/**
 * The card goes where the person drags it, always whole on screen, and stays there next
 * time. `enabled` false (phones): it keeps its fixed place.
 */
export function useDraggableCard(
  cardRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  /** A press that did not move the card, with the element it began on. */
  onTap?: (target: EventTarget | null) => void,
) {
  const [offset, setOffset] = useState<CardOffset | undefined>();
  const [dragging, setDragging] = useState(false);
  // Sliding into its corner after a drop (no slide with reduced motion).
  const [snapping, setSnapping] = useState(false);
  const start = useRef<DragStart | null>(null);
  // Whether the last press moved the card: a press that did not is a click.
  const moved = useRef(false);
  // Each page has its own field to keep clear: the saved place is checked again on arrival.
  const { pathname } = useLocation();

  useEffect(() => {
    const card = cardRef.current;
    if (!enabled || !card) return;
    const fit = (wanted: CardOffset | undefined) => {
      if (!wanted) return undefined;
      const size = measure(card);
      const screen = viewport();
      return clearOfAreas(clampOffset(wanted, size, screen), size, screen, areasToKeepClear());
    };
    setOffset(fit(savedCardOffset()));
    // The window shrinks, or the card grows (a button appears): it stays whole on screen.
    const onResize = () => setOffset((current) => fit(current));
    const observer = new ResizeObserver(onResize);
    observer.observe(card);
    window.addEventListener("resize", onResize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", onResize);
    };
    // pathname checks the saved place again on each page, whose field may sit under it.
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [cardRef, enabled, pathname]);

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    const card = cardRef.current;
    if (!card || event.button !== 0 || startsOnControl(event.target)) return;
    start.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      offset: currentOffset(card),
      target: event.target,
    };
    moved.current = false;
    setSnapping(false);
    // Without dragging (phones) a press is only watched for a tap.
    if (!enabled) return;
    card.setPointerCapture(event.pointerId);
    setDragging(true);
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    const card = cardRef.current;
    const from = start.current;
    if (!card || !from) return;
    const dx = event.clientX - from.pointerX;
    const dy = event.clientY - from.pointerY;
    if (Math.hypot(dx, dy) > CLICK_SLOP) moved.current = true;
    if (!enabled) return;
    const wanted = { right: from.offset.right - dx, bottom: from.offset.bottom - dy };
    setOffset(clampOffset(wanted, measure(card), viewport()));
  }

  function onPointerUp(event: PointerEvent<HTMLElement>) {
    const card = cardRef.current;
    const from = start.current;
    if (!card || !from) return;
    start.current = null;
    if (!moved.current) onTap?.(from.target);
    if (!enabled) return;
    card.releasePointerCapture(event.pointerId);
    setDragging(false);
    if (!moved.current) return;
    const settled = snapToCorner(
      currentOffset(card),
      measure(card),
      viewport(),
      areasToKeepClear(),
    );
    setSnapping(!prefersReducedMotion());
    setOffset(settled);
    saveCardOffset(settled);
  }

  /** The browser took the press over (a scroll, a gesture): never a tap. */
  function onPointerCancel(event: PointerEvent<HTMLElement>) {
    moved.current = true;
    onPointerUp(event);
  }

  function backToCorner() {
    setOffset(undefined);
    clearCardOffset();
  }

  /** With the card itself focused: arrows move it, Home takes it back to the corner. */
  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    const card = cardRef.current;
    if (!enabled || !card || event.target !== card) return;
    if (event.key === "Home") {
      event.preventDefault();
      backToCorner();
      return;
    }
    const wanted = nudgeOffset(currentOffset(card), event.key, event.shiftKey);
    if (!wanted) return;
    event.preventDefault();
    const next = clampOffset(wanted, measure(card), viewport());
    setOffset(next);
    saveCardOffset(next);
  }

  function onDoubleClick(event: MouseEvent<HTMLElement>) {
    if (enabled && !startsOnControl(event.target)) backToCorner();
  }

  return {
    dragging,
    style:
      enabled && offset
        ? {
            right: offset.right,
            bottom: offset.bottom,
            transition: snapping
              ? `right ${SNAP_MS}ms ease-out, bottom ${SNAP_MS}ms ease-out`
              : undefined,
          }
        : undefined,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onKeyDown,
      onDoubleClick,
    },
  };
}
