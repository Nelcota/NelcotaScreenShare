import { useEffect } from "react";
import { useLocation, useNavigate, useNavigation } from "react-router";
import { roomLink } from "@/features/room/domain/room-code";
import { HIDDEN_ROOM_PATH, roomAddressState } from "@/features/room/client/hidden-room-address";
import { currentStreamerMode, useStreamerMode } from "@/features/room/hooks/use-streamer-mode";

/**
 * Streamer mode also hides the code from the address bar: while the room page is open,
 * the bar shows `/sala` and this tab remembers which room it is (a reload finds it again).
 * Turning the mode off brings the full address back.
 */
export function useHiddenRoomAddress(code: string, invite: string | undefined, active: boolean) {
  const { enabled } = useStreamerMode();
  const location = useLocation();
  const navigate = useNavigate();
  const navigation = useNavigation();

  useEffect(() => {
    // During hydration `enabled` still holds the server's cautious default (hidden):
    // wait for the saved choice, or the address would flicker for everyone.
    if (!active || navigation.state !== "idle" || enabled !== currentStreamerMode()) return;
    const masked = location.mask?.pathname === HIDDEN_ROOM_PATH;
    if (enabled === masked) return;
    void navigate(roomLink(code, invite), {
      replace: true,
      mask: enabled ? HIDDEN_ROOM_PATH : undefined,
      state: roomAddressState(location.state, code, invite),
    });
  }, [active, enabled, code, invite, location, navigate, navigation.state]);
}
