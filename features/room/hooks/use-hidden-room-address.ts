import { useEffect } from "react";
import { roomLink } from "@/features/room/domain/room-code";
import { HIDDEN_ROOM_PATH, rememberRoomAddress } from "@/features/room/client/hidden-room-address";
import { currentStreamerMode, useStreamerMode } from "@/features/room/hooks/use-streamer-mode";

function replaceAddress(path: string) {
  // Keeps the router's history entry (its state) and only swaps what the bar shows.
  window.history.replaceState(window.history.state, "", path);
}

/**
 * Streamer mode also hides the code from the address bar: while the room page is open,
 * the bar shows `/sala` and this tab remembers which room it is (a reload finds it again).
 * Turning the mode off brings the full address back.
 */
export function useHiddenRoomAddress(code: string, invite: string | undefined, active: boolean) {
  const { enabled } = useStreamerMode();

  useEffect(() => {
    // During hydration `enabled` still holds the server's cautious default (hidden):
    // wait for the saved choice, or the address would flicker for everyone.
    if (!active || enabled !== currentStreamerMode()) return;
    if (enabled) {
      rememberRoomAddress(code, invite);
      replaceAddress(HIDDEN_ROOM_PATH);
      return;
    }
    if (window.location.pathname === HIDDEN_ROOM_PATH) replaceAddress(roomLink(code, invite));
  }, [active, enabled, code, invite]);
}
