/** Labels for URL segments that are not in the navigation (e.g. "conta"). */
const SEGMENT_LABELS: Record<string, string> = {
  admin: "Início",
  conta: "Minha conta",
  "sem-permissao": "Sem permissão",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface Crumb {
  label: string;
  /** `null` for a segment with no page of its own ("Minha conta"): it is shown, not linked. */
  href: string | null;
  current: boolean;
}

/**
 * The panel's breadcrumbs for a path. Only the home and the pages in the navigation are
 * links; the current page is the last crumb.
 */
export function adminBreadcrumbs(pathname: string, navLabels: ReadonlyMap<string, string>) {
  const parts = pathname.split("/").filter(Boolean);
  return parts.map((part, index): Crumb => {
    const path = `/${parts.slice(0, index + 1).join("/")}`;
    const current = index === parts.length - 1;
    const isPage = current || path === "/admin" || navLabels.has(path);
    return {
      // IDs in the URL (detail pages) become "Detalhes": the page title says which one.
      label: navLabels.get(path) ?? SEGMENT_LABELS[part] ?? (UUID.test(part) ? "Detalhes" : part),
      href: isPage ? path : null,
      current,
    };
  });
}
