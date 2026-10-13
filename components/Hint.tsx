import type { ReactElement } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** A tooltip; with `shortcut`, the key shows next to the text. */
export function Hint({
  text,
  shortcut,
  children,
}: {
  text?: string;
  shortcut?: string;
  children: ReactElement;
}) {
  if (!text) return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent sideOffset={8}>
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
