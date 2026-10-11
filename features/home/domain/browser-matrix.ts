import type { ShareSupport } from "@/features/room/domain/share-support";

/** One row of the home "Will it work here?" table. */
export interface BrowserRow {
  id: "chromium" | "firefox" | "safari" | "mobile";
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
    id: "mobile",
    name: "Celular e tablet",
    screen: false,
    audio: false,
    summary: "Assiste, fala e usa o chat.",
  },
];

const ROW_BY_SUPPORT: Record<ShareSupport, BrowserRow["id"] | null> = {
  full: "chromium",
  "screen-only": "firefox",
  safari: "safari",
  mobile: "mobile",
  unsupported: null,
};

/** Which row describes the visitor's browser (null before hydration or when it is unknown). */
export function visitorRow(support: ShareSupport | null): BrowserRow["id"] | null {
  if (support === null) return null;
  return ROW_BY_SUPPORT[support];
}
