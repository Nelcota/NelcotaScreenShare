const MAX_LENGTH = 140;

/**
 * Short, safe text for a LiveKit event that failed to project. Database errors carry the
 * query and its parameters (names, IPs): only the kind of failure is shown.
 */
export function summarizeEventError(error: string | null | undefined): string {
  if (!error) return "Erro sem descrição";
  if (error.startsWith("Failed query")) return "Falha ao gravar no banco";
  if (error.trimStart().startsWith("[")) return "Evento em formato inesperado";
  const firstLine = error.split("\n", 1)[0]?.trim() ?? "";
  if (!firstLine) return "Erro sem descrição";
  if (firstLine.length <= MAX_LENGTH) return firstLine;
  return `${firstLine.slice(0, MAX_LENGTH - 1)}…`;
}
