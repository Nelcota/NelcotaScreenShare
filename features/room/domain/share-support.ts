/**
 * What the viewer's browser can do in the room. Screen sharing is
 * detected by feature (getDisplayMedia); computer audio cannot be
 * checked in advance, so it comes from the browser engine.
 */
export type ShareSupport =
  /** Chrome, Edge and other Chromium browsers on desktop: screen and audio. */
  | "full"
  /** Firefox on desktop: screen, without computer audio. */
  | "screen-only"
  /** Safari on Mac: screen, no audio. */
  | "safari"
  /** Phone or tablet whose browser opens the screen picker (Safari on iOS 27+): screen, no audio. */
  | "mobile-screen"
  /** iPhone or iPad whose browser does not share yet: Safari on iOS 27 does. */
  | "ios-outdated"
  /** Other phones and tablets (Android): watch and talk, do not share. */
  | "mobile"
  /** Desktop with an old browser or without the feature. */
  | "unsupported";

export interface BrowserTraits {
  userAgent: string;
  hasDisplayMedia: boolean;
  /** navigator.userAgentData.mobile, when the browser reports it. */
  mobileHint?: boolean | undefined;
  /** iPad presents itself as a Mac; touch gives it away. */
  maxTouchPoints?: number;
}

export function classifyShareSupport({
  userAgent,
  hasDisplayMedia,
  mobileHint,
  maxTouchPoints = 0,
}: BrowserTraits): ShareSupport {
  const ipadAsMac = /Macintosh/.test(userAgent) && maxTouchPoints > 1;
  const apple = /iPhone|iPad|iPod/.test(userAgent) || ipadAsMac;
  const mobile = mobileHint ?? (/Android|Mobile/i.test(userAgent) || apple);
  if (mobile) return mobileShareSupport(hasDisplayMedia, apple);
  if (!hasDisplayMedia) return "unsupported";
  if (/Firefox\//.test(userAgent)) return "screen-only";
  // Safari has "Safari/" but not "Chrome/" (Chromium includes both).
  if (/Safari\//.test(userAgent) && !/Chrome\/|Chromium\//.test(userAgent)) return "safari";
  return "full";
}

/**
 * Phones share only where the browser itself offers the picker: Safari since iOS 27; Android
 * browsers do not expose it yet. Detected by feature, so a browser that adds it just works.
 */
function mobileShareSupport(hasDisplayMedia: boolean, apple: boolean): ShareSupport {
  if (hasDisplayMedia) return "mobile-screen";
  if (apple) return "ios-outdated";
  return "mobile";
}

/** Reads the current browser's traits (client only). */
export function currentShareSupport(): ShareSupport {
  const nav = navigator as Navigator & { userAgentData?: { mobile?: boolean } };
  return classifyShareSupport({
    userAgent: nav.userAgent,
    hasDisplayMedia: canShareScreen(),
    mobileHint: nav.userAgentData?.mobile,
    maxTouchPoints: nav.maxTouchPoints,
  });
}

/** Does the browser open the screen picker? */
function canShareScreen(): boolean {
  return "getDisplayMedia" in (navigator.mediaDevices ?? {});
}

/** Can the person start a screen share from this browser? */
export function canShare(support: ShareSupport): boolean {
  return (
    support === "full" ||
    support === "screen-only" ||
    support === "safari" ||
    support === "mobile-screen"
  );
}

/** Is this a phone or a tablet? There the dock keeps the camera next to the share button. */
export function isMobileShare(support: ShareSupport): boolean {
  return support === "mobile-screen" || support === "ios-outdated" || support === "mobile";
}

/**
 * Does the person pick a screen, a window or a tab in our menu first? A phone's picker
 * only offers its own screen, so the share starts right away.
 */
export function picksSurface(support: ShareSupport): boolean {
  return support !== "mobile-screen";
}

/** Does the browser ignore an ideal capture size? WebKit (Safari, also on iOS) needs a maximum. */
export function capsCaptureSize(support: ShareSupport): boolean {
  return support === "safari" || support === "mobile-screen";
}

/**
 * Does the browser float its own "sharing your screen" bar at the bottom of the display?
 * Chromium does for a screen or a window (tabs get a bar inside the tab instead); "Ocultar"
 * only minimizes it, and Windows brings it back. The page cannot move it, so the dock rises.
 */
export function showsCaptureBar(support: ShareSupport, surface: string | undefined): boolean {
  if (support !== "full") return false;
  return surface === "monitor" || surface === "window";
}

/** Does the computer audio go along with the screen? Only Chromium on desktop. */
export function sharesAudio(support: ShareSupport): boolean {
  return support === "full";
}

export const SHARE_SUPPORT_TEXT: Record<
  ShareSupport,
  { tone: "ok" | "warn" | "info"; title: string; detail?: string }
> = {
  full: { tone: "ok", title: "Seu navegador compartilha tela e áudio." },
  "screen-only": {
    tone: "ok",
    title: "Seu navegador compartilha a tela.",
    detail: "O som do computador não vai junto. Para isso, use o Chrome ou o Edge.",
  },
  safari: {
    tone: "warn",
    title: "No Safari, a tela vai sem o áudio.",
    detail: "Para compartilhar com som, use o Chrome ou o Edge.",
  },
  "mobile-screen": {
    tone: "ok",
    title: "Seu celular compartilha a tela.",
    detail: "O som do celular não vai junto.",
  },
  "ios-outdated": {
    tone: "info",
    title: "No iPhone, compartilhar a tela pede o iOS 27.",
    detail: "Atualize o iPhone e use o Safari, ou entre pelo computador.",
  },
  mobile: {
    tone: "info",
    title: "No celular você assiste e conversa.",
    detail: "Para compartilhar a tela, entre pelo computador.",
  },
  unsupported: {
    tone: "warn",
    title: "Este navegador não compartilha a tela.",
    detail: "Use o Chrome, o Edge ou o Firefox atualizados.",
  },
};

/** The support note as one sentence, for a toast. */
export function shareSupportMessage(support: ShareSupport): string {
  const { title, detail } = SHARE_SUPPORT_TEXT[support];
  return detail ? `${title} ${detail}` : title;
}

/** What to share: the whole screen, a window or a tab (with or without sound). */
export type ShareSurface = "monitor" | "window" | "browser";

export interface ShareChoice {
  surface: ShareSurface;
  audio: boolean;
}

/** What a Nelcota tab in a call tells whoever captures it (Chromium's Capture Handle). */
export const CALL_CAPTURE_HANDLE = "nelcota-call";

/** Is the captured tab a Nelcota tab in a call? */
export function capturesCall(captureHandle: { handle?: string } | null | undefined): boolean {
  return captureHandle?.handle === CALL_CAPTURE_HANDLE;
}

/**
 * Computer audio from a whole screen or a window also carries the room's own playback.
 * Chromium 141+ strips it (`restrictOwnAudio`); without that, the others would hear their
 * own voice coming back. Our own tab is never offered, but another tab in a call plays
 * a room too.
 */
export function echoesRoomAudio(
  surface: string | undefined,
  ownAudioRestricted: boolean | undefined,
  capturedCall = false,
): boolean {
  if (capturedCall) return true;
  if (surface === "browser") return false;
  return ownAudioRestricted !== true;
}

/**
 * Does the browser send sound from this surface? A tab always does. A whole screen or a
 * window only where the room can be stripped from the computer audio: elsewhere it is not
 * asked for. Chromium 141 brought `restrictOwnAudio` and `windowAudio` together.
 */
export function surfaceHasAudio(surface: ShareSurface, ownAudioRestrictable: boolean): boolean {
  if (surface === "browser") return true;
  return ownAudioRestrictable;
}

/** What the picker offers as sound for a window (`getDisplayMedia`'s `windowAudio`). */
export type WindowAudioPreference = "exclude" | "system" | "window";

export interface ComputerAudioOptions {
  systemAudio: "include" | "exclude";
  windowAudio: WindowAudioPreference;
}

/**
 * Which computer audio the picker offers. A window (a game, a player) goes with the system
 * audio, the same one a whole screen sends: `restrictOwnAudio` strips the room from it, so
 * nobody hears their own voice. Without that, neither is offered.
 */
export function computerAudioOptions(
  audio: boolean,
  ownAudioRestrictable: boolean,
): ComputerAudioOptions {
  if (!audio || !ownAudioRestrictable) return { systemAudio: "exclude", windowAudio: "exclude" };
  return { systemAudio: "include", windowAudio: "system" };
}

/** Does this browser strip the page's own playback from the computer audio? (client only) */
export function canRestrictOwnAudio(): boolean {
  const supported: MediaTrackSupportedConstraints & { restrictOwnAudio?: boolean } =
    navigator.mediaDevices.getSupportedConstraints();
  return supported.restrictOwnAudio === true;
}
