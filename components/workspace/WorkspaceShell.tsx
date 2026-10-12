import type { ReactNode } from "react";
import { NavLink } from "react-router";
import { AppHeader } from "@/components/shell/AppHeader";
import { SiteFooter } from "@/components/shell/SiteFooter";
import { navItemClass } from "@/components/shell/nav-item-class";

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
        <header>
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 max-w-2xl text-ink-muted">{description}</p>
        </header>
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
