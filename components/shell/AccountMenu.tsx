import { ChevronDown, LogOut, Settings, Sparkles } from "lucide-react";
import { Popover } from "radix-ui";
import { Link } from "react-router";
import { NavPopover } from "@/components/shell/NavBar";
import { UserAvatar } from "@/components/UserAvatar";
import { cn } from "@/lib/utils";

const ITEM =
  "flex h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-base transition-colors hover:bg-surface-3 focus-visible:outline-2 focus-visible:outline-brand";

/** The signed-in account in the bar: the photo and name, and a menu with the account pages. */
export function AccountMenu({
  account,
  accountHref = "/conta",
}: {
  account: { name: string; image: string | null };
  accountHref?: string;
}) {
  return (
    <NavPopover
      label="Sua conta"
      align="end"
      className="max-w-44 pl-0.5 max-sm:pr-1"
      trigger={
        <>
          <UserAvatar image={account.image} className="size-8" />
          <span className="truncate max-sm:sr-only">{account.name}</span>
          <ChevronDown
            className="size-4 shrink-0 text-ink-muted max-sm:hidden"
            aria-hidden="true"
          />
        </>
      }
    >
      <nav aria-label="Sua conta" className="-m-2 flex flex-col gap-0.5">
        <Popover.Close asChild>
          <Link viewTransition to={accountHref} className={ITEM}>
            <Settings className="size-4 text-ink-muted" aria-hidden="true" />
            Configurações
          </Link>
        </Popover.Close>
        <Popover.Close asChild>
          <Link viewTransition to="/novidades" className={ITEM}>
            <Sparkles className="size-4 text-ink-muted" aria-hidden="true" />
            Novidades
          </Link>
        </Popover.Close>
        <form method="post" action="/sair" className="mt-1 border-t border-line pt-1">
          <button type="submit" className={cn(ITEM, "cursor-pointer")}>
            <LogOut className="size-4 text-ink-muted" aria-hidden="true" />
            Sair
          </button>
        </form>
      </nav>
    </NavPopover>
  );
}
