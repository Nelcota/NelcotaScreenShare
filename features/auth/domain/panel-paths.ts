/** Where a request lands, as far as hiding the panel goes. */
export type PanelPath =
  | { kind: "outside" }
  | { kind: "invitation"; token: string }
  | { kind: "reset"; token: string }
  | { kind: "panel" };

const INVITATION = /^\/admin\/convite\/([^/]+)$/;
const RESET_PATH = "/admin/redefinir-senha";

/** The panel's pages, their data requests (`.data`) and its own API, including sign-in. */
function isPanel(path: string): boolean {
  return path === "/admin" || path.startsWith("/admin/") || path.startsWith("/api/admin/");
}

/**
 * Sorts a request: outside the panel, a link that carries its own token (an invitation,
 * which also covers the owner's recovery, or a new-password link), or the rest of the panel.
 */
export function classifyPanelPath(pathname: string, search: URLSearchParams): PanelPath {
  const path = pathname.replace(/\.data$/, "");
  if (!isPanel(path)) return { kind: "outside" };
  const invitation = INVITATION.exec(path)?.[1];
  if (invitation) return { kind: "invitation", token: decodeURIComponent(invitation) };
  const reset = path === RESET_PATH ? search.get("token") : null;
  if (reset) return { kind: "reset", token: reset };
  return { kind: "panel" };
}
