import { Inbox } from "lucide-react";
import { NavLink } from "react-router";
import { Hint } from "@/components/Hint";
import { Button } from "@/components/ui/button";
import { UnreadCount } from "@/components/UnreadCount";
import { requestsButtonLabel, requestsButtonText } from "@/features/friends/domain/requests-button";
import { useToggleLink } from "@/features/friends/hooks/use-app-panel";
import { cn } from "@/lib/utils";

const REQUESTS_PATH = "/amigos/pedidos";

/**
 * Friend requests: the word "Pedidos" or, with some waiting, how many. `compact` (the
 * collapsed column) keeps the icon with the count on its corner. A second click closes the
 * panel.
 */
export function RequestsButton({
  count,
  compact = false,
  className,
}: {
  count: number;
  compact?: boolean;
  className?: string;
}) {
  const toggle = useToggleLink(REQUESTS_PATH);
  const pending = count > 0;
  return (
    <Hint text="Pedidos de amizade">
      <Button
        asChild
        variant={pending ? "brand-outline" : "quiet"}
        size={compact ? "icon-lg" : "default"}
        className={cn(
          "relative",
          compact ? null : "h-9 gap-1.5 px-3",
          pending ? null : "border-line-strong",
          className,
        )}
      >
        <NavLink
          viewTransition
          end
          to={REQUESTS_PATH}
          onClick={toggle.onClick}
          aria-label={requestsButtonLabel(count)}
        >
          <Inbox aria-hidden="true" />
          {compact ? (
            <UnreadCount count={count} aria-hidden="true" />
          ) : (
            <span aria-hidden="true" className="tabular-nums">
              {requestsButtonText(count)}
            </span>
          )}
        </NavLink>
      </Button>
    </Hint>
  );
}
