/**
 * Friend codes, shown as NELC-4K7Q2X: easy to read aloud and to type. The alphabet leaves out
 * 0, O, 1, I and L, which look alike. New codes have six characters, too many to guess one
 * after another; when the draws start to clash they get seven. Codes from before, with four
 * or five, keep working.
 */
export const FRIEND_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** Draws of six characters before trying seven: about 887 million codes, then 27 billion. */
const SHORT_DRAWS = 3;

export type FriendCodeLength = 6 | 7;

/** How long the code of this draw is: six first, seven once those keep clashing. */
export function friendCodeLength(draw: number): FriendCodeLength {
  return draw < SHORT_DRAWS ? 6 : 7;
}

const PREFIX = "NELC";
/** Four or five characters for codes from before, six or seven for new ones. */
const BODY = /^[2-9A-HJKMNP-Z]{4,7}$/;
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
export function randomFriendCode(
  pick: (max: number) => number,
  length: FriendCodeLength = 6,
): string {
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
