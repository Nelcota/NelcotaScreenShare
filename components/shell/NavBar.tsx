import { Link } from "react-router";
import { Popover } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { use, useId } from "react";
import { Switch } from "@/components/ui/switch";
import { ShortcutSettings } from "@/lib/hooks/use-shortcut";
import { ROOM_SHORTCUTS } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";
import { navItemClass } from "./nav-item-class";
import { Hint } from "@/components/Hint";

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
      <Popover.Portal>
        <Popover.Content
          data-slot="popover-content"
          side="bottom"
          align={align}
          sideOffset={12}
          collisionPadding={16}
          aria-label={label}
          className="glass z-50 w-[min(20rem,calc(100vw-2rem))] origin-(--radix-popover-content-transform-origin) rounded-2xl p-4 outline-none"
        >
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function ShortcutsPanel() {
  const settings = use(ShortcutSettings);
  const switchId = useId();
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <label
          htmlFor={settings ? switchId : undefined}
          className="text-sm font-medium tracking-tight"
        >
          Atalhos na sala
        </label>
        {settings ? (
          <Switch id={switchId} checked={settings.enabled} onCheckedChange={settings.setEnabled} />
        ) : null}
      </div>
      <dl className="mt-3 flex flex-col gap-2">
        {ROOM_SHORTCUTS.map(({ key, action }) => (
          <div key={key} className="flex items-center gap-3 text-sm">
            <dt>
              <kbd className="grid size-7 place-items-center rounded-lg border border-line-strong bg-surface-2 text-xs font-medium">
                {key}
              </kbd>
            </dt>
            <dd className="text-ink-muted">{action}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-ink-subtle">
        {settings?.enabled === false
          ? "Atalhos desligados nesta chamada."
          : "Desligue para jogar sem acionar a chamada."}
      </p>
    </>
  );
}
