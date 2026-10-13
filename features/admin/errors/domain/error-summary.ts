const MAX_MESSAGE = 200;
const MAX_PATH = 200;
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
// Tokens, ids and other long opaque segments (invitation links carry a token in the path).
const OPAQUE_SEGMENT = /^[A-Za-z0-9_-]{20,}$/;

/**
 * Short, safe text for an unexpected server error. Database errors carry the query and its
 * parameters, and other messages can carry an e-mail: neither reaches the panel.
 */
export function summarizeError(error: unknown): { name: string; message: string } {
  const name = error instanceof Error ? error.name.slice(0, 100) : "Erro";
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.startsWith("Failed query")) return { name, message: "Falha numa consulta ao banco" };
  const firstLine = raw.split("\n", 1)[0]?.trim().replace(EMAIL, "[e-mail]") ?? "";
  if (!firstLine) return { name, message: "Sem mensagem" };
  if (firstLine.length <= MAX_MESSAGE) return { name, message: firstLine };
  return { name, message: `${firstLine.slice(0, MAX_MESSAGE - 1)}…` };
}

/** The request path without the query string and with opaque segments masked. */
export function safePath(url: string): string {
  const path = new URL(url, "http://localhost").pathname;
  return path
    .split("/")
    .map((segment) => (OPAQUE_SEGMENT.test(segment) ? ":id" : segment))
    .join("/")
    .slice(0, MAX_PATH);
}
