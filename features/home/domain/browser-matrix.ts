import type { ShareSupport } from "@/features/room/domain/share-support";

/** One row of the home "Will it work here?" table. */
export interface BrowserRow {
  id: "chromium" | "firefox" | "safari" | "ios" | "android";
  name: string;
  screen: boolean;
  audio: boolean;
  /** What the person does there, in one short sentence. */
  summary: string;
}

export const BROWSER_ROWS: readonly BrowserRow[] = [
  {
    id: "chromium",
    name: "Chrome, Edge, Brave e outros Chromium",
    screen: true,
    audio: true,
    summary: "Tela e som do computador.",
  },
  { id: "firefox", name: "Firefox", screen: true, audio: false, summary: "Tela, sem o som." },
  { id: "safari", name: "Safari no Mac", screen: true, audio: false, summary: "Tela, sem o som." },
  {
    id: "ios",
    name: "iPhone e iPad",
    screen: true,
    audio: false,
    summary: "Tela no Safari com iOS 27, sem o som.",
  },
  {
    id: "android",
    name: "Celular Android",
    screen: false,
    audio: false,
    summary: "Assiste, fala e usa o chat.",
  },
];

// An iPhone on an older iOS gets no card: the note under the cards tells it to update.
const ROW_BY_SUPPORT: Record<ShareSupport, BrowserRow["id"] | null> = {
  full: "chromium",
  "screen-only": "firefox",
  safari: "safari",
  "mobile-screen": "ios",
  "ios-outdated": null,
  mobile: "android",
  unsupported: null,
};

/** Which row describes the visitor's browser (null before hydration or when it is unknown). */
export function visitorRow(support: ShareSupport | null): BrowserRow["id"] | null {
  if (support === null) return null;
  return ROW_BY_SUPPORT[support];
}
