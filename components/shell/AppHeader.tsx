import { Menu } from "lucide-react";
import { Popover } from "radix-ui";
import { Link, NavLink } from "react-router";
import type { ComponentProps, ReactNode } from "react";
import { NavBar, NavBrand, NavDivider, NavPopover } from "@/components/shell/NavBar";
import { navItemClass } from "@/components/shell/nav-item-class";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface AppHeaderProps {
  account: { name: string; image: string | null } | null;
  accountHref?: string;
  accountCurrent?: boolean;
  showAuthLinks?: boolean;
  actions?: ReactNode;
  className?: string;
  "data-anim"?: string;
}

/** Where the site goes; the hash links land on the home page's scenes. */
const SITE_LINKS = [
  { to: "/#como-funciona", label: "Como funciona" },
  { to: "/#precos", label: "Preços" },
  { to: "/novidades", label: "Novidades" },
];

const WORKSPACE_LINKS = [
  { to: "/salas", label: "Minhas salas" },
  { to: "/times", label: "Times" },
];

/**
 * A site link. Only a real page can be the current one: hash links share the home page's
 * path, so they never get the mark.
 */
function SiteLink({
  to,
  label,
  ...props
}: { to: string; label: string } & Omit<ComponentProps<"a">, "href" | "children">) {
  // The rest (class, and the menu's close handler) goes straight to the link.
  if (to.includes("#")) {
    return (
      <Link viewTransition to={to} {...props}>
        {label}
      </Link>
    );
  }
  return (
    <NavLink viewTransition to={to} {...props}>
      {label}
    </NavLink>
  );
}

/** Phones: the site links, and "Criar conta" for visitors, behind a menu button. */
function MobileMenu({ showSignUp, signedIn }: { showSignUp: boolean; signedIn: boolean }) {
  return (
    <NavPopover
      trigger={<Menu className="size-5" aria-hidden="true" />}
      label="Menu"
      iconOnly
      align="end"
      className="w-9 justify-center px-0 md:hidden"
    >
      <nav aria-label="Menu" className="flex flex-col gap-1">
        {(signedIn ? WORKSPACE_LINKS : SITE_LINKS).map(({ to, label }) => (
          <Popover.Close key={to} asChild>
            <SiteLink to={to} label={label} className={cn(navItemClass, "h-11 text-base")} />
          </Popover.Close>
        ))}
        {showSignUp ? (
          <Popover.Close asChild>
            <Button asChild size="lg" className="mt-2 w-full">
              <Link viewTransition to="/cadastro">
                Criar conta
              </Link>
            </Button>
          </Popover.Close>
        ) : null}
      </nav>
    </NavPopover>
  );
}

/** The signed-in account, or the sign-in links for visitors (when the page shows them). */
function AccountLinks({
  account,
  accountHref,
  accountCurrent,
  showAuthLinks,
}: Required<Pick<AppHeaderProps, "account" | "accountHref" | "accountCurrent" | "showAuthLinks">>) {
  if (account) {
    return (
      <>
        <NavDivider />
        <Link
          viewTransition
          to={accountHref}
          aria-label="Minha conta"
          aria-current={accountCurrent ? "page" : undefined}
          className={cn(navItemClass, "max-w-44 pl-0.5 max-lg:pr-0.5")}
        >
          <UserAvatar image={account.image} className="size-8" />
          <span className="truncate max-lg:hidden">{account.name}</span>
        </Link>
      </>
    );
  }
  if (!showAuthLinks) return null;
  return (
    <>
      <NavDivider />
      <Link viewTransition to="/entrar" className={navItemClass}>
        Entrar
      </Link>
      <Button asChild className="max-sm:hidden">
        <Link viewTransition to="/cadastro">
          Criar conta
        </Link>
      </Button>
    </>
  );
}

/** Shared navigation for the app pages, before and after the call. */
export function AppHeader({
  account,
  accountHref = "/conta",
  accountCurrent = false,
  showAuthLinks = true,
  actions,
  className,
  "data-anim": animation,
}: AppHeaderProps) {
  return (
    <header data-anim={animation} className={cn("px-4 pt-4 sm:px-6", className)}>
      <NavBar aria-label="Principal" className="mx-auto max-w-5xl">
        <NavBrand href="/" />
        <NavDivider className="max-md:hidden" />
        {(account ? WORKSPACE_LINKS : SITE_LINKS).map(({ to, label }) => (
          <SiteLink key={to} to={to} label={label} className={cn(navItemClass, "max-md:hidden")} />
        ))}
        <ThemeToggle className="ml-auto" />
        <AccountLinks
          account={account}
          accountHref={accountHref}
          accountCurrent={accountCurrent}
          showAuthLinks={showAuthLinks}
        />
        {actions ? (
          <>
            <NavDivider />
            {actions}
          </>
        ) : null}
        <MobileMenu signedIn={account !== null} showSignUp={account === null && showAuthLinks} />
      </NavBar>
    </header>
  );
}
