import { Inbox } from "lucide-react";
import { NavLink } from "react-router";
import { Hint } from "@/components/Hint";
import { Button } from "@/components/ui/button";
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
      <Button
        asChild
        variant="quiet"
        size="icon-lg"
        className={cn("relative border-line-strong", className)}
      >
        <NavLink viewTransition end to={REQUESTS_PATH} onClick={toggle.onClick} aria-label={label}>
          <Inbox aria-hidden="true" />
          <UnreadCount count={count} aria-hidden="true" />
        </NavLink>
      </Button>
    </Hint>
  );
}
