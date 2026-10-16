import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type CountTone = "danger" | "brand";

const TONES: Record<CountTone, string> = {
  danger: "bg-danger text-canvas",
  brand: "bg-brand text-brand-ink",
};

/**
 * An unread or pending count. By default it sits on the top-right corner of a relative
 * parent (a photo, an icon); `className` moves it or, with `static`, puts it inline.
 * Past `max` it reads "99+" (or "9+").
 */
export function UnreadCount({
  count,
  tone = "danger",
  max = 99,
  className,
  ...props
}: Omit<ComponentProps<"span">, "children"> & {
  count: number;
  tone?: CountTone;
  max?: number;
}) {
  if (count <= 0) return null;
  return (
    <span
      {...props}
      className={cn(
        "absolute -top-1 -right-1 z-10 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[0.625rem] font-bold ring-2 ring-surface",
        TONES[tone],
        className,
      )}
    >
      {count > max ? `${max}+` : count}
    </span>
  );
}
