import { Menu } from "lucide-react";
import { Popover } from "radix-ui";
import { Link, NavLink } from "react-router";
import type { ComponentProps, ReactNode } from "react";
import { NavBar, NavBrand, NavDivider, NavPopover } from "@/components/shell/NavBar";
import { navItemClass } from "@/components/shell/nav-item-class";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { AccountMenu } from "@/components/shell/AccountMenu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface AppHeaderProps {
  account: { name: string; image: string | null } | null;
  accountHref?: string;
  /** Inside the app: the logo goes to the app's start and "Abrir" is not needed. */
  inApp?: boolean;
  showAuthLinks?: boolean;
  actions?: ReactNode;
  className?: string;
  "data-anim"?: string;
}

/** The app's start, where "Abrir" and the logo inside the app lead. */
const APP_START_PATH = "/inicio";

/** Where the site goes; the hash links land on the home page's scenes. */
const SITE_LINKS = [
  { to: "/#como-funciona", label: "Como funciona" },
  { to: "/#precos", label: "Preços" },
  { to: "/novidades", label: "Novidades" },
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
function MobileMenu({ showSignUp }: { showSignUp: boolean }) {
  return (
    <NavPopover
      trigger={<Menu className="size-5" aria-hidden="true" />}
      label="Menu"
      iconOnly
      align="end"
      className="w-9 justify-center px-0 md:hidden"
    >
      <nav aria-label="Menu" className="flex flex-col gap-1">
        {SITE_LINKS.map(({ to, label }) => (
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

/** The sign-in links for visitors (when the page shows them). */
function VisitorLinks({ showAuthLinks }: { showAuthLinks: boolean }) {
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
  inApp = false,
  showAuthLinks = true,
  actions,
  className,
  "data-anim": animation,
}: AppHeaderProps) {
  return (
    <header data-anim={animation} className={cn("px-4 pt-4 sm:px-6", className)}>
      <NavBar aria-label="Principal" className="mx-auto max-w-5xl">
        <NavBrand href={inApp ? APP_START_PATH : "/"} />
        {account ? null : (
          <>
            <NavDivider className="max-md:hidden" />
            {SITE_LINKS.map(({ to, label }) => (
              <SiteLink
                key={to}
                to={to}
                label={label}
                className={cn(navItemClass, "max-md:hidden")}
              />
            ))}
          </>
        )}
        <ThemeToggle className="ml-auto" />
        {account && !inApp ? (
          <Button asChild className="ml-1 max-sm:px-3">
            <Link viewTransition to={APP_START_PATH}>
              Abrir
            </Link>
          </Button>
        ) : null}
        {account ? (
          <AccountMenu account={account} accountHref={accountHref} />
        ) : (
          <VisitorLinks showAuthLinks={showAuthLinks} />
        )}
        {actions ? (
          <>
            <NavDivider />
            {actions}
          </>
        ) : null}
        {account ? null : <MobileMenu showSignUp={showAuthLinks} />}
      </NavBar>
    </header>
  );
}
