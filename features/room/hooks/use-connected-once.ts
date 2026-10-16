import { useState } from "react";
import { ConnectionState } from "livekit-client";

/** Whether this call has reached Connected at least once; reconnecting keeps it true. */
export function useConnectedOnce(connectionState: ConnectionState): boolean {
  const [connectedOnce, setConnectedOnce] = useState(false);
  const next = connectedOnce || connectionState === ConnectionState.Connected;
  // Adjusting state while rendering: the first connected frame already picks the right view.
  if (next !== connectedOnce) setConnectedOnce(next);
  return next;
}
