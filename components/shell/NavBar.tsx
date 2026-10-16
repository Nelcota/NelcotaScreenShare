import { Link } from "react-router";
import { Popover } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { navItemClass } from "./nav-item-class";
import { Hint } from "@/components/Hint";
import { GlassPopoverContent } from "@/components/GlassPopover";

/** Top glass bar, used on the home page and in the room. Sections separated by `NavDivider`. */
export function NavBar({ className, ...props }: ComponentProps<"nav">) {
  return (
    <nav
      className={cn(
        "glass flex h-14 items-center gap-1 rounded-2xl px-2 transition-colors duration-(--motion-surface) sm:px-2.5",
        className,
      )}
      {...props}
    />
  );
}

export function NavDivider({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn("mx-1.5 h-6 w-px shrink-0 bg-line-strong", className)} />
  );
}

/** Icon + name. Without `href` it is not a link (in the room, leaving by mistake would drop the call). */
export function NavBrand({
  href,
  showName = true,
  className: extraClass,
}: {
  href?: string;
  showName?: boolean;
  className?: string;
}) {
  const content = (
    <>
      <img
        src="/icon.png"
        alt={href ? "" : "Nelcota"}
        width={28}
        height={28}
        className="size-7 shrink-0"
      />
      {showName ? <span className="text-sm font-semibold tracking-tight">Nelcota</span> : null}
    </>
  );
  const className = cn("flex shrink-0 items-center gap-2 rounded-xl px-2 py-1.5", extraClass);
  return href ? (
    <Link
      viewTransition
      to={href}
      aria-label="Nelcota, início"
      className={cn(className, "transition-colors hover:bg-surface-3")}
    >
      {content}
    </Link>
  ) : (
    <span className={className}>{content}</span>
  );
}

/** Navbar item that opens a panel (popover) below it. */
export function NavPopover({
  trigger,
  label,
  iconOnly = false,
  align = "start",
  className,
  children,
}: {
  trigger: ReactNode;
  label: string;
  /** Icon-only trigger: uses `label` as the accessible name. */
  iconOnly?: boolean;
  /** Items on the right side of the bar open aligned to the end. */
  align?: "start" | "end";
  className?: string;
  children: ReactNode;
}) {
  return (
    <Popover.Root>
      <Hint text={iconOnly ? label : undefined}>
        <Popover.Trigger
          aria-label={iconOnly ? label : undefined}
          className={cn(navItemClass, className)}
        >
          {trigger}
        </Popover.Trigger>
      </Hint>
      <GlassPopoverContent
        side="bottom"
        align={align}
        sideOffset={12}
        aria-label={label}
        width="md"
        className="p-4"
      >
        {children}
      </GlassPopoverContent>
    </Popover.Root>
  );
}
