/** A label in parentheses, like "(sem conta)", is not part of the name. */
const LABEL = /\([^)]*\)/g;
/** Words that make a name start with a letter or a digit. */
const NAME_WORD = /^[\p{L}\p{N}]/u;

/** First letter of the first and last names. */
export function initials(name: string): string {
  const parts = name
    .replace(LABEL, " ")
    .trim()
    .split(/\s+/)
    .filter((part) => NAME_WORD.test(part));
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "";
  return `${first}${last}`.toLocaleUpperCase("pt-BR");
}
