/**
 * The one list of terms that no public text someone chooses may carry: a room address and
 * name, a team name, a name in a call. Approved by Guilherme on 2026-10-16 (#396).
 *
 * Common words that only offend by context ("preto", "macaco") stay out on purpose, so a
 * normal name is never refused.
 */

/** Refused as a whole word, after normalizing (see `textWords`). */
const BLOCKED_WORDS: ReadonlySet<string> = new Set([
  // Nazism and hate.
  "heil",
  "kkk",
  "nazismo",
  // Child abuse.
  "pedo",
  "cp",
  "novinha",
  "estupro",
  "estuprador",
  // The most common racist and homophobic slurs, in Portuguese and English.
  "nigger",
  "nigga",
  "faggot",
  "tranny",
  "chink",
  "kike",
  "spic",
  "viadinho",
  "boiola",
  "traveco",
  // Pornography.
  "porn",
  "porno",
  "xxx",
  "putaria",
  // Terror and extreme violence.
  "terrorista",
  "massacre",
  "atentado",
]);

/** Refused even inside another word: roots with no innocent use. */
const BLOCKED_ROOTS: readonly string[] = ["nazi", "hitler", "pedofil"];

/** Refused as two words side by side. */
const BLOCKED_PAIRS: readonly (readonly [string, string])[] = [["supremacia", "branca"]];

/** Refused as written, before digits become letters: hate codes made of numbers. */
const BLOCKED_NUMBERS: ReadonlySet<string> = new Set(["1488"]);

/** Digits and symbols used in place of letters ("n4z1"). */
const LOOKALIKES: Readonly<Record<string, string>> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  $: "s",
};

/** Lowercase, without accents. */
function plain(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function withoutLookalikes(word: string): string {
  return word.replace(/[013457@$]/g, (character) => LOOKALIKES[character] ?? character);
}

/** The words of a text, split at spaces, hyphens, dots and the like. */
function rawWords(text: string): string[] {
  return plain(text)
    .split(/[^\p{L}\p{N}@$]+/u)
    .filter((word) => word.length > 0);
}

/** One word: a blocked number as written, or a blocked word or root once letters are back. */
function blockedWord(word: string): boolean {
  if (BLOCKED_NUMBERS.has(word)) return true;
  const letters = withoutLookalikes(word);
  if (BLOCKED_WORDS.has(letters)) return true;
  return BLOCKED_ROOTS.some((root) => letters.includes(root));
}

function blockedPair(words: readonly string[]): boolean {
  return BLOCKED_PAIRS.some(([first, second]) =>
    words.some((word, index) => word === first && words[index + 1] === second),
  );
}

/**
 * Does this text carry a blocked term? Case, accents, hyphens and digits in place of
 * letters do not hide it ("Pedó-filo", "n4z1", "HEIL"). Roots are looked for inside each
 * word, never across two, so "Ana Zimmer" is not "anazi…".
 */
export function hasBlockedTerm(text: string): boolean {
  const words = rawWords(text);
  if (words.some(blockedWord)) return true;
  return blockedPair(words.map(withoutLookalikes));
}

/** What someone sees when a text is refused for a blocked term. */
export const BLOCKED_TERM_MESSAGE = "Esse texto não pode ser usado.";
