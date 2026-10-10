import { createContext, useContext } from "react";

export const StreamerModeContext = createContext<{
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
} | null>(null);

export function useStreamerMode() {
  const settings = useContext(StreamerModeContext);
  if (!settings) throw new Error("Streamer mode requires an active room");
  return settings;
}
