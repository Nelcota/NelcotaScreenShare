import { Loader2 } from "lucide-react";
import type { ComponentProps } from "react";
import { Hint } from "@/components/Hint";
import { gsap, MOTION_DURATION, prefersReducedMotion, useGSAP } from "@/lib/animation/gsap";
import { cn } from "@/lib/utils";

type DockTone = "default" | "active" | "danger" | "muted" | "testing";

const toneClasses: Record<DockTone, string> = {
  // Filled without a border: the dock's groups and separators already organize it.
  default: "border-transparent bg-control text-ink group-hover:bg-control-hover",
  active: "border-brand bg-brand text-brand-ink group-hover:bg-brand-hover",
  // Leave: solid, so it is not confused with "Mudo" (translucent red).
  danger: "border-danger bg-danger text-canvas group-hover:bg-danger/90",
  muted: "border-danger/25 bg-danger/15 text-danger group-hover:bg-danger/25",
  // The microphone test: amber, neither on nor off.
  testing: "border-transparent bg-warning/15 text-warning group-hover:bg-warning/25",
};

const captionClasses: Record<DockTone, string> = {
  default: "text-ink/85 group-hover:text-ink",
  active: "text-ink",
  // The red button already says "leave"; neutral text keeps the dock light.
  danger: "text-ink/85 group-hover:text-ink",
  muted: "text-danger",
  testing: "text-warning",
};

interface DockButtonProps extends Omit<ComponentProps<"button">, "aria-label"> {
  label: string;
  tone?: DockTone;
  pressed?: boolean;
  busy?: boolean;
  /** Shortcut key, shown in the tooltip (e.g. "M"). */
  shortcut?: string;
  /** Visible name under the icon (non-technical users do not guess icons; phones have no tooltip). */
  caption?: string;
  /** Short version of the name for phones (e.g. "Tela" instead of "Compartilhar"). */
  shortCaption?: string;
  /** Icon surface adjustment for grouped controls. */
  iconClassName?: string;
}

/**
 * Dock button: a surface with an icon and a name below.
 * Tooltip with the shortcut and micro-interactions via GSAP. Forwards props and
 * ref to the <button>, so it works as a trigger for Radix primitives
 * (`<Popover.Trigger asChild>`). For unavailable, use `aria-disabled`: with
 * `disabled` the tooltip does not open.
 */
export function DockButton({
  label,
  tone = "default",
  pressed,
  busy = false,
  shortcut,
  caption,
  shortCaption,
  iconClassName,
  className,
  children,
  onPointerLeave,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
  ...props
}: DockButtonProps) {
  const { contextSafe } = useGSAP();

  // Only the icon surface reacts (not the whole button): in the microphone
  // control, which has two halves, nothing comes loose from the group.
  const animate = contextSafe((button: HTMLElement, vars: gsap.TweenVars) => {
    const surface = button.querySelector<HTMLElement>("[data-dock-surface]");
    if (
      !surface ||
      prefersReducedMotion() ||
      button.matches(":disabled") ||
      button.getAttribute("aria-disabled") === "true"
    )
      return;
    gsap.to(surface, { duration: MOTION_DURATION.surface, overwrite: "auto", ...vars });
  });

  return (
    <Hint text={label} shortcut={shortcut} side="top" sideOffset={10}>
      <button
        type="button"
        data-anim="dock-item"
        aria-label={label}
        aria-pressed={pressed}
        aria-busy={busy || undefined}
        aria-keyshortcuts={shortcut}
        {...props}
        onPointerLeave={(event) => {
          onPointerLeave?.(event);
          animate(event.currentTarget, { scale: 1 });
        }}
        onPointerDown={(event) => {
          onPointerDown?.(event);
          animate(event.currentTarget, { scale: 0.96, duration: MOTION_DURATION.feedback });
        }}
        onPointerUp={(event) => {
          onPointerUp?.(event);
          animate(event.currentTarget, { scale: 1 });
        }}
        onPointerCancel={(event) => {
          onPointerCancel?.(event);
          animate(event.currentTarget, { scale: 1 });
        }}
        className={cn(
          "group flex shrink-0 cursor-pointer touch-manipulation flex-col items-center gap-2 rounded-xl outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
          caption ? "min-w-11 sm:min-w-16" : "",
          className,
        )}
      >
        <span
          data-dock-surface=""
          className={cn(
            "relative grid size-11 place-items-center rounded-xl border transition-colors duration-150 group-focus-visible:ring-3 group-focus-visible:ring-brand/60 sm:size-12",
            toneClasses[tone],
            iconClassName,
          )}
        >
          {busy ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : children}
        </span>
        {caption ? (
          <span
            aria-hidden="true"
            className={cn(
              "text-xs leading-4 font-medium whitespace-nowrap sm:text-[0.8125rem] [@media(max-height:32rem)]:hidden",
              captionClasses[tone],
            )}
          >
            {shortCaption ? (
              <>
                <span className="sm:hidden">{shortCaption}</span>
                <span className="max-sm:hidden">{caption}</span>
              </>
            ) : (
              caption
            )}
          </span>
        ) : null}
      </button>
    </Hint>
  );
}
