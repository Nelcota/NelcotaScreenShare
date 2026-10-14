import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * An unread or pending count. By default it sits on the top-right corner of a relative
 * parent (a photo, an icon); `className` moves it or, with `static`, puts it inline.
 */
export function UnreadCount({
  count,
  className,
  ...props
}: Omit<ComponentProps<"span">, "children"> & { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      {...props}
      className={cn(
        "absolute -top-1 -right-1 z-10 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[0.625rem] font-bold text-canvas ring-2 ring-surface",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
