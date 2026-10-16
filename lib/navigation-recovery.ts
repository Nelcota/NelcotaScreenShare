import { useEffect } from "react";
import { useNavigation } from "react-router";

/**
 * After a deploy, a tab opened earlier asks for a route chunk that no longer exists, or a
 * manifest of another version. React Router then loads the page again, but the page it is
 * ON, not the one that was clicked: the link looks dead. The target is kept while a
 * navigation loads, and loading the page it left again right after goes on to that target.
 */
const KEY = "nelcota:pending-navigation";
const FRESH_MS = 15_000;

type SessionStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

interface PendingNavigation {
  href: string;
  /** The page the navigation left: only reloading this one means it was interrupted. */
  from: string;
  at: number;
}

/**
 * A page of this app, the only kind of target worth resuming. Server endpoints (/api/...)
 * and files (/robots.txt) are not: resuming one would repeat it, and an e-mail link to
 * /api/auth/verify-email would spend its token twice.
 */
function isAppPage(href: string): boolean {
  if (!href.startsWith("/") || href.startsWith("//")) return false;
  const path = href.split(/[?#]/, 1)[0] ?? "";
  if (path === "/api" || path.startsWith("/api/")) return false;
  return !/\.[a-z0-9]+$/i.test(path);
}

export function rememberPendingNavigation(
  store: SessionStore,
  { href, from, now }: { href: string; from: string; now: number },
) {
  if (!isAppPage(href)) return;
  store.setItem(KEY, JSON.stringify({ href, from, at: now } satisfies PendingNavigation));
}

export function forgetPendingNavigation(store: SessionStore) {
  store.removeItem(KEY);
}

function readPending(store: SessionStore): PendingNavigation | null {
  const raw = store.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    if (!("href" in parsed) || !("from" in parsed) || !("at" in parsed)) return null;
    const { href, from, at } = parsed;
    if (typeof href !== "string" || typeof from !== "string") return null;
    if (typeof at !== "number") return null;
    return { href, from, at };
  } catch {
    return null;
  }
}

/**
 * Where to go after this document load, if it interrupted a navigation: the page that was
 * left loaded again, within a few seconds. Any other load (a typed address, a redirect, a
 * link from outside) is the person going somewhere else. Only paths of this app.
 */
export function recoveredTarget(
  store: SessionStore,
  { current, now }: { current: string; now: number },
): string | null {
  const pending = readPending(store);
  forgetPendingNavigation(store);
  if (!pending) return null;
  if (now - pending.at > FRESH_MS) return null;
  if (!isAppPage(pending.href)) return null;
  if (pending.from !== current) return null;
  if (pending.href === current) return null;
  return pending.href;
}

function sessionStore(): SessionStore | null {
  try {
    return window.sessionStorage;
  } catch {
    // Storage blocked (private mode, site data off): no recovery, links still work.
    return null;
  }
}

function currentHref(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

/**
 * The page a plain click on a link of this app is about to open. Taken at the click, since
 * React Router may give up before its navigation even starts (manifest of another version).
 */
function clickedHref(event: MouseEvent): string | null {
  if (event.defaultPrevented || event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  if (!(event.target instanceof Element)) return null;
  const link = event.target.closest("a");
  if (!link || link.target || link.hasAttribute("download")) return null;
  if (link.origin !== window.location.origin) return null;
  return `${link.pathname}${link.search}${link.hash}`;
}

/** Keeps the target of the navigation in progress and resumes it after a forced reload. */
export function useNavigationRecovery() {
  const navigation = useNavigation();
  const target = navigation.location;
  const href = target ? `${target.pathname}${target.search}${target.hash}` : null;

  useEffect(() => {
    const store = sessionStore();
    if (!store) return;
    const next = recoveredTarget(store, { current: currentHref(), now: Date.now() });
    if (next) window.location.replace(next);
  }, []);

  useEffect(() => {
    const store = sessionStore();
    if (!store) return;
    const remember = (event: MouseEvent) => {
      const clicked = clickedHref(event);
      const from = currentHref();
      if (clicked && clicked !== from)
        rememberPendingNavigation(store, { href: clicked, from, now: Date.now() });
    };
    document.addEventListener("click", remember, true);
    return () => document.removeEventListener("click", remember, true);
  }, []);

  useEffect(() => {
    const store = sessionStore();
    if (!store) return;
    if (navigation.state === "loading" && href) {
      rememberPendingNavigation(store, { href, from: currentHref(), now: Date.now() });
      return;
    }
    if (navigation.state === "idle") forgetPendingNavigation(store);
  }, [navigation.state, href]);
}
