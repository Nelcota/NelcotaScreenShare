import {
  createElement,
  createContext,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { logBrowserWarning } from "@/lib/telemetry.client";

const STORAGE_KEY = "nelcota-streamer-mode";
const CHANGE_EVENT = "nelcota-streamer-mode-change";
let fallback = false;
let warned = false;
let storageBlocked = false;

function warn(error: unknown) {
  if (warned) return;
  warned = true;
  logBrowserWarning("Could not access streamer mode storage", error);
}

export function currentStreamerMode(): boolean {
  if (typeof window === "undefined" || storageBlocked) return fallback;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "1") return true;
    if (saved === "0") return false;
  } catch (error) {
    storageBlocked = true;
    warn(error);
  }
  return fallback;
}

export function setStreamerMode(enabled: boolean) {
  fallback = enabled;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  } catch (error) {
    storageBlocked = true;
    warn(error);
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeStreamerMode(changed: () => void) {
  window.addEventListener(CHANGE_EVENT, changed);
  window.addEventListener("storage", changed);
  return () => {
    window.removeEventListener(CHANGE_EVENT, changed);
    window.removeEventListener("storage", changed);
  };
}

const StreamerModeContext = createContext<{
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
} | null>(null);

export function StreamerModeProvider({ children }: { children: ReactNode }) {
  // Hide invitations during SSR/hydration until this browser's preference is known.
  const enabled = useSyncExternalStore(subscribeStreamerMode, currentStreamerMode, () => true);
  return createElement(
    StreamerModeContext,
    { value: { enabled, setEnabled: setStreamerMode } },
    children,
  );
}

export function useStreamerMode() {
  const settings = useContext(StreamerModeContext);
  if (!settings) throw new Error("Streamer mode requires a room host");
  return settings;
}
