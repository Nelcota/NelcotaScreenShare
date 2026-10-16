import { useRef, useState, type ComponentProps, type ReactElement } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type ContentProps = ComponentProps<typeof TooltipContent>;

/**
 * Focus that came without a cue: a popover or dialog moving focus to its first button, not the
 * keyboard (no :focus-visible) nor the mouse (not hovered). The tooltip stays closed then, so
 * opening a list does not cover its first row with a hint.
 */
function focusedWithoutCue(element: HTMLElement | null): boolean {
  if (!element || document.activeElement !== element) return false;
  return !element.matches(":focus-visible") && !element.matches(":hover");
}

/** A tooltip; with `shortcut`, the key shows next to the text. */
export function Hint({
  text,
  shortcut,
  side,
  sideOffset = 8,
  children,
}: {
  text?: string;
  shortcut?: string;
  side?: ContentProps["side"];
  sideOffset?: number;
  children: ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  if (!text) return children;
  return (
    <Tooltip
      open={open}
      onOpenChange={(next) => setOpen(next && !focusedWithoutCue(triggerRef.current))}
    >
      <TooltipTrigger asChild ref={triggerRef}>
        {children}
      </TooltipTrigger>
      <TooltipContent side={side} sideOffset={sideOffset}>
        {text}
        {shortcut ? (
          <kbd
            data-slot="kbd"
            className="bg-background/15 px-1.5 py-0.5 font-sans text-xs font-medium"
          >
            {shortcut}
          </kbd>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}
