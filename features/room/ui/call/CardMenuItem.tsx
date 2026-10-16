import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * One action on someone's card: an icon and a label, aligned left like a menu item.
 * `danger` is for the action that removes the person.
 */
export function CardMenuItem({
  icon,
  danger = false,
  className,
  children,
  ...props
}: Omit<ComponentProps<"button">, "type"> & { icon: ReactNode; danger?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm font-medium transition-colors hover:bg-control focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-60",
        danger ? "text-danger [&_svg]:text-danger" : "text-ink [&_svg]:text-ink-muted",
        className,
      )}
    >
      <span aria-hidden="true" className="grid size-4 shrink-0 place-items-center [&_svg]:size-4">
        {icon}
      </span>
      {children}
    </button>
  );
}
