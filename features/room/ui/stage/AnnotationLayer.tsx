import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from "react";
import { useVideoContentBox } from "@/features/room/hooks/use-video-content-box";
import { moveCursor } from "@/features/room/domain/pointer-cursor";
import type { AnnotationPoint } from "@/features/room/domain/annotations";
import type { AnnotationControl } from "@/features/room/hooks/use-annotations";

export function AnnotationLayer({
  videoRef,
  control,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  control: AnnotationControl;
}) {
  const box = useVideoContentBox(videoRef);
  const surface = useRef<HTMLButtonElement>(null);
  const draft = useRef<{ id: string; points: AnnotationPoint[]; time: number } | undefined>(
    undefined,
  );
  const [cursor, setCursor] = useState({ x: 0.5, y: 0.5 });
  const markerId = useId();
  const { tool, draw } = control;
  useEffect(() => {
    draft.current = undefined;
    if (tool) surface.current?.focus({ preventScroll: true });
  }, [tool]);
  if (!box) return null;
  function append(next: AnnotationPoint) {
    const entry = draft.current;
    if (!entry || !tool) return;
    entry.points =
      tool === "pen" ? [...entry.points.slice(0, 63), next] : [entry.points[0] ?? next, next];
    draw(entry.id, tool, entry.points, entry.time, true);
  }
  function finish() {
    const entry = draft.current;
    if (!entry || !tool) return;
    if (entry.points.length > 1) draw(entry.id, tool, entry.points, entry.time, false);
    draft.current = undefined;
  }
  function keyboard(event: KeyboardEvent<HTMLButtonElement>) {
    if (!tool) return;
    const next = moveCursor(cursor, event.key, event.shiftKey);
    if (next) {
      event.preventDefault();
      setCursor(next);
      if (draft.current) append(next);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      draft.current = undefined;
      control.setTool(undefined);
      return;
    }
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    if (draft.current) {
      append(cursor);
      finish();
      return;
    }
    draft.current = { id: crypto.randomUUID(), points: [cursor], time: Date.now() };
  }
  return (
    <button
      type="button"
      ref={surface}
      aria-label="Anotações temporárias. Use as setas e Enter para iniciar e concluir uma marca; Escape cancela."
      disabled={!tool}
      tabIndex={tool ? 0 : -1}
      className="absolute outline-none"
      style={{
        ...box,
        touchAction: tool ? "none" : undefined,
        pointerEvents: tool ? "auto" : "none",
      }}
      onKeyDown={keyboard}
      onPointerDown={(event) => {
        if (!tool) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        draft.current = { id: crypto.randomUUID(), points: [point(event)], time: Date.now() };
      }}
      onPointerMove={(event) => {
        if (draft.current) append(point(event));
      }}
      onPointerUp={(event) => {
        append(point(event));
        finish();
      }}
      onPointerCancel={() => {
        draft.current = undefined;
      }}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 1000 1000"
        preserveAspectRatio="none"
        className="size-full"
      >
        <defs>
          <marker
            id={markerId}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#facc15" />
          </marker>
        </defs>
        {control.marks.map((mark) => {
          const first = mark.points[0];
          const last = mark.points.at(-1);
          if (!first || !last) return null;
          const common = {
            stroke: "#facc15",
            strokeWidth: 3,
            fill: "none",
            vectorEffect: "non-scaling-stroke",
          };
          return (
            <g
              key={`${mark.author}/${mark.id}`}
              data-annotation={mark.id}
              opacity={mark.preview ? 0.5 : 1}
            >
              {mark.shape === "arrow" ? (
                <line
                  {...common}
                  x1={first.x * 1000}
                  y1={first.y * 1000}
                  x2={last.x * 1000}
                  y2={last.y * 1000}
                  markerEnd={`url(#${markerId})`}
                />
              ) : null}
              {mark.shape === "circle" ? (
                <ellipse
                  {...common}
                  cx={(first.x + last.x) * 500}
                  cy={(first.y + last.y) * 500}
                  rx={Math.abs(last.x - first.x) * 500}
                  ry={Math.abs(last.y - first.y) * 500}
                />
              ) : null}
              {mark.shape === "pen" ? (
                <polyline
                  {...common}
                  points={mark.points.map((p) => `${p.x * 1000},${p.y * 1000}`).join(" ")}
                />
              ) : null}
            </g>
          );
        })}
        {tool ? (
          <circle
            cx={cursor.x * 1000}
            cy={cursor.y * 1000}
            r="8"
            fill="#fff"
            stroke="#111"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>
      {control.marks
        .filter((mark) => !mark.preview)
        .map((mark) => (
          <span
            key={`${mark.author}/${mark.id}`}
            className="pointer-events-none absolute max-w-28 truncate rounded bg-black/80 px-1 text-xs text-yellow-300"
            style={{
              left: `${Math.min(85, (mark.points[0]?.x ?? 0) * 100)}%`,
              top: `${Math.max(0, (mark.points[0]?.y ?? 0) * 100 - 5)}%`,
            }}
          >
            {mark.name}
          </span>
        ))}
    </button>
  );
}

function point(event: PointerEvent<HTMLButtonElement>): AnnotationPoint {
  const rect = event.currentTarget.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
    y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
  };
}
