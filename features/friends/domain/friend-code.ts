/**
 * Friend codes, shown as NELC-4K7Q: easy to read aloud and to type. The alphabet leaves out
 * 0, O, 1, I and L, which look alike. Four characters while they are easy to find; when the
 * draws start to clash, new codes get five, and the old ones keep working.
 */
export const FRIEND_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** Draws of four characters before trying five: about 920 thousand codes, then 28 million. */
const SHORT_DRAWS = 3;

/** How long the code of this draw is: four first, five once the short ones keep clashing. */
export function friendCodeLength(draw: number): 4 | 5 {
  return draw < SHORT_DRAWS ? 4 : 5;
}

const PREFIX = "NELC";
const BODY = /^[2-9A-HJKMNP-Z]{4,5}$/;
const SEPARATORS = /[\s-]/g;

/** "NELC-4K7Q" from the stored "4K7Q". */
export function formatFriendCode(code: string): string {
  return `${PREFIX}-${code}`;
}

/**
 * The stored code from what the person typed: "nelc-4k7q", "NELC 4K7Q" or just "4K7Q".
 * Null when it cannot be a code.
 */
export function parseFriendCode(input: string): string | null {
  const compact = input.replace(SEPARATORS, "").toUpperCase();
  const body = compact.startsWith(PREFIX) ? compact.slice(PREFIX.length) : compact;
  if (!BODY.test(body)) return null;
  return body;
}

/** A new random code; `pick` returns an integer in [0, max). */
export function randomFriendCode(pick: (max: number) => number, length: 4 | 5 = 4): string {
  const characters = Array.from(
    { length },
    () => FRIEND_CODE_ALPHABET[pick(FRIEND_CODE_ALPHABET.length)],
  );
  return characters.join("");
}

/** Whether the person typed an e-mail rather than a code. */
export function looksLikeEmail(input: string): boolean {
  return input.includes("@");
}
