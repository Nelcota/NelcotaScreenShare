import { Popover } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type GlassWidth = "sm" | "md" | "lg";

/** Fixed widths that never pass the screen's edges (1rem each side). */
const WIDTHS: Record<GlassWidth, string> = {
  sm: "w-[min(18rem,calc(100vw-2rem))]",
  md: "w-[min(20rem,calc(100vw-2rem))]",
  lg: "w-[min(22rem,calc(100vw-2rem))]",
};

/**
 * A floating glass panel: the same surface, collision padding and entrance (grows from the
 * trigger, sliding in from its side) for every popover in the room and the navigation.
 * Defaults to opening above, as the dock does; `width` picks one of the shared widths.
 */
export function GlassPopoverContent({
  className,
  children,
  width,
  side = "top",
  sideOffset = 14,
  ...props
}: ComponentProps<typeof Popover.Content> & { width?: GlassWidth }) {
  return (
    <Popover.Portal>
      <Popover.Content
        data-slot="popover-content"
        side={side}
        align="center"
        sideOffset={sideOffset}
        collisionPadding={16}
        {...props}
        className={cn(
          "glass z-50 origin-(--radix-popover-content-transform-origin) rounded-2xl p-2 outline-none",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          "motion-reduce:animate-none",
          width ? WIDTHS[width] : undefined,
          className,
        )}
      >
        {children}
      </Popover.Content>
    </Popover.Portal>
  );
}
