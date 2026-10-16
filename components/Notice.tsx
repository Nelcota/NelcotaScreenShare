import type { HTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type NoticeTone = "brand" | "success" | "warning" | "danger";

const TONES: Record<NoticeTone, string> = {
  brand: "border-brand/30 bg-brand/10",
  success: "border-success/35 bg-success/10",
  warning: "border-warning/40 bg-warning/10",
  danger: "border-danger/30 bg-danger/15 text-danger",
};

const ICON_TONES: Record<NoticeTone, string> = {
  brand: "text-brand-soft",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

type NoticeElement = "p" | "div" | "output";

/**
 * A boxed message in one of the app's tones. `as="output"` for results the page announces,
 * `role="alert"` for errors. The icon, if any, comes first in the tone's color.
 */
export function Notice({
  tone,
  icon: Icon,
  as: Element = "p",
  className,
  children,
  ...props
}: Omit<HTMLAttributes<HTMLElement>, "children"> & {
  tone: NoticeTone;
  icon?: LucideIcon;
  as?: NoticeElement;
  children: ReactNode;
}) {
  return (
    <Element
      {...props}
      className={cn(
        "flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm",
        TONES[tone],
        className,
      )}
    >
      {Icon ? (
        <Icon className={cn("size-4 shrink-0", ICON_TONES[tone])} aria-hidden="true" />
      ) : null}
      {children}
    </Element>
  );
}
