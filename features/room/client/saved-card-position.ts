import { parseOffset, type CardOffset } from "@/features/room/domain/card-position";

const CARD_KEY = "nelcota:cartao-chamada";

/** Where the person left the call card last time in this browser. */
export function savedCardOffset(): CardOffset | undefined {
  try {
    return parseOffset(localStorage.getItem(CARD_KEY));
  } catch {
    return undefined;
  }
}

export function saveCardOffset(offset: CardOffset) {
  try {
    localStorage.setItem(CARD_KEY, JSON.stringify(offset));
  } catch {
    // Storage blocked: the card just goes back to the corner next time.
  }
}

/** Back to the corner: nothing saved. */
export function clearCardOffset() {
  try {
    localStorage.removeItem(CARD_KEY);
  } catch {
    // Storage blocked: nothing was saved either.
  }
}
