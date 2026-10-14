import { Inbox } from "lucide-react";
import { NavLink } from "react-router";
import { Hint } from "@/components/Hint";
import { UnreadCount } from "@/components/UnreadCount";
import { useToggleLink } from "@/features/friends/hooks/use-app-panel";
import { cn } from "@/lib/utils";

const REQUESTS_PATH = "/amigos/pedidos";

/** Friend requests as a small icon with the count; a second click closes the panel. */
export function RequestsButton({ count, className }: { count: number; className?: string }) {
  const toggle = useToggleLink(REQUESTS_PATH);
  const label = count > 0 ? `Pedidos de amizade: ${count}` : "Pedidos de amizade";
  return (
    <Hint text="Pedidos de amizade">
      <NavLink
        viewTransition
        end
        to={REQUESTS_PATH}
        onClick={toggle.onClick}
        aria-label={label}
        className={cn(
          "relative grid size-9 shrink-0 place-items-center rounded-full border border-line-strong text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink focus-visible:outline-2 focus-visible:outline-brand aria-[current=page]:bg-surface-3 aria-[current=page]:text-ink",
          className,
        )}
      >
        <Inbox className="size-4" aria-hidden="true" />
        <UnreadCount count={count} aria-hidden="true" />
      </NavLink>
    </Hint>
  );
}
