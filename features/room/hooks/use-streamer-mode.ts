import {
  createElement,
  createContext,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createStoredValue } from "@/lib/stored-value";

const streamerMode = createStoredValue<boolean>({
  key: "nelcota-streamer-mode",
  changeEvent: "nelcota-streamer-mode-change",
  fallback: false,
  parse: (raw) => (raw === "1" ? true : raw === "0" ? false : undefined),
  serialize: (enabled) => (enabled ? "1" : "0"),
  warning: "Could not access streamer mode storage",
});

export const currentStreamerMode = streamerMode.read;
export const setStreamerMode = streamerMode.write;
export const subscribeStreamerMode = streamerMode.subscribe;

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
