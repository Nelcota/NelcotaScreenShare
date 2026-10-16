import type { ComponentProps, ReactElement } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type ContentProps = ComponentProps<typeof TooltipContent>;

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
  if (!text) return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
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
