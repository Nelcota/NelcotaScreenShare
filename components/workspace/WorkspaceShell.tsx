import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Link, NavLink, useMatches } from "react-router";
import { Hint } from "@/components/Hint";
import { AppHeader } from "@/components/shell/AppHeader";
import { SiteFooter } from "@/components/shell/SiteFooter";
import { navItemClass } from "@/components/shell/nav-item-class";
import { Button } from "@/components/ui/button";

/** The app layout's route id: inside it, the column already has the Salas and Times tabs. */
const APP_LAYOUT_ID = "app";

function Heading({ title, description }: { title: string; description: string }) {
  return (
    <header>
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 max-w-2xl text-ink-muted">{description}</p>
    </header>
  );
}

/** Inside the app: the page in the middle panel, with the X back to the start. */
function WorkspacePanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="relative flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <Hint text="Fechar" shortcut="Esc">
        <Button
          asChild
          variant="quiet"
          size="icon-lg"
          className="absolute top-3 right-3 max-sm:hidden"
        >
          <Link viewTransition to="/inicio" aria-label="Fechar">
            <X aria-hidden="true" />
          </Link>
        </Button>
      </Hint>
      <Heading title={title} description={description} />
      {children}
    </div>
  );
}

export function WorkspaceShell({
  account,
  title,
  description,
  children,
}: {
  account: { name: string; image: string | null };
  title: string;
  description: string;
  children: ReactNode;
}) {
  const inApp = useMatches().some((match) => match.id === APP_LAYOUT_ID);
  if (inApp) {
    return (
      <WorkspacePanel title={title} description={description}>
        {children}
      </WorkspacePanel>
    );
  }
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <AppHeader account={account} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
        <nav aria-label="Meu espaço" className="flex flex-wrap gap-2">
          <NavLink to="/salas" className={navItemClass}>
            Minhas salas
          </NavLink>
          <NavLink to="/times" className={navItemClass}>
            Times
          </NavLink>
        </nav>
        <Heading title={title} description={description} />
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
