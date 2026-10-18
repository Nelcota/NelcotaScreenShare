import { Link } from "react-router";
import { cn } from "@/lib/utils";

const LINK = "transition-colors hover:text-ink";

/** The same footer on every public and account page: the brand, then where to go next. */
export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        "site-column flex flex-col items-center gap-4 border-t border-line py-6 sm:flex-row sm:justify-between",
        className,
      )}
    >
      <Link
        viewTransition
        to="/"
        className="inline-flex items-center gap-2 text-sm font-semibold"
        aria-label="Nelcota, início"
      >
        <img src="/icon.png" alt="" width={24} height={24} className="size-6 rounded-md" />
        Nelcota
      </Link>
      <nav
        aria-label="Rodapé"
        className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-medium text-ink-muted"
      >
        <Link viewTransition to="/#como-funciona" className={LINK}>
          Como funciona
        </Link>
        <Link viewTransition to="/#precos" className={LINK}>
          Preços
        </Link>
        <Link viewTransition to="/novidades" className={LINK}>
          Novidades
        </Link>
        <Link viewTransition to="/privacidade" className={LINK}>
          Privacidade
        </Link>
        <span className="text-ink-subtle">© 2026</span>
      </nav>
    </footer>
  );
}
