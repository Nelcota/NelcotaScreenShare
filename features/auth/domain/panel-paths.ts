/** Where a request lands, as far as hiding the panel goes. */
export type PanelPath =
  | { kind: "outside" }
  | { kind: "invitation"; token: string }
  | { kind: "reset"; token: string }
  | { kind: "panel" };

const INVITATION = /^\/admin\/convite\/([^/]+)$/i;
const RESET_PATH = "/admin/redefinir-senha";

/** The panel's pages, their data requests (`.data`) and its own API, including sign-in. */
function isPanel(path: string): boolean {
  return path === "/admin" || path.startsWith("/admin/") || path.startsWith("/api/admin/");
}

/**
 * The path as React Router matches it: decoded, with repeated slashes joined and without the
 * data suffix. `null` when it cannot be decoded.
 */
function decodedPath(pathname: string): string | null {
  try {
    return decodeURIComponent(pathname)
      .replace(/\/{2,}/g, "/")
      .replace(/\.data$/i, "");
  } catch {
    return null;
  }
}

/**
 * Sorts a request: outside the panel, a link that carries its own token (an invitation,
 * which also covers the owner's recovery, or a new-password link), or the rest of the panel.
 * Routes match ignoring case and after decoding, so the check does the same; a path that
 * cannot be decoded counts as the panel, so it is hidden from anyone outside the team.
 */
export function classifyPanelPath(pathname: string, search: URLSearchParams): PanelPath {
  const decoded = decodedPath(pathname);
  if (decoded === null) return { kind: "panel" };
  const path = decoded.toLowerCase();
  if (!isPanel(path)) return { kind: "outside" };
  // The token keeps its case: it is compared by its hash.
  const invitation = INVITATION.exec(decoded)?.[1];
  if (invitation) return { kind: "invitation", token: invitation };
  const reset = path === RESET_PATH ? search.get("token") : null;
  if (reset) return { kind: "reset", token: reset };
  return { kind: "panel" };
}
