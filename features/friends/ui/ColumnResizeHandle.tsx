import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { clampColumnWidth, COLUMN_WIDTH } from "@/features/friends/domain/column-layout";

const KEY_STEP = 16;

/**
 * The column's right edge: drag it (or use the arrows) to change the width; a double click
 * goes back to the initial width. `onChange` runs while dragging, `onCommit` at the end.
 */
export function ColumnResizeHandle({
  width,
  onChange,
  onCommit,
}: {
  width: number;
  onChange: (width: number) => void;
  onCommit: (width: number) => void;
}) {
  const drag = useRef<{ startX: number; startWidth: number; last: number } | null>(null);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startX: event.clientX, startWidth: width, last: width };
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current) return;
    current.last = clampColumnWidth(current.startWidth + event.clientX - current.startX);
    onChange(current.last);
  }

  function onPointerUp() {
    const current = drag.current;
    drag.current = null;
    if (!current) return;
    onCommit(current.last);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = { ArrowLeft: -KEY_STEP, ArrowRight: KEY_STEP }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    onCommit(clampColumnWidth(width + step));
  }

  return (
    <div
      // A focusable splitter: <hr> cannot take the pointer and key handlers.
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
      role="separator"
      aria-orientation="vertical"
      aria-label="Largura da coluna de amigos"
      aria-valuemin={COLUMN_WIDTH.min}
      aria-valuemax={COLUMN_WIDTH.max}
      aria-valuenow={width}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={() => onCommit(COLUMN_WIDTH.initial)}
      onKeyDown={onKeyDown}
      className="group hidden w-3 shrink-0 cursor-col-resize touch-none justify-center outline-none sm:flex"
    >
      <span className="my-6 w-0.5 rounded-full transition-colors group-hover:bg-brand/60 group-focus-visible:bg-brand group-active:bg-brand" />
    </div>
  );
}
