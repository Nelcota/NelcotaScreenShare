/** Accents and case do not matter in a search: "José" matches "jose". */
export function searchable(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}
