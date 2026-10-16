import { useConnectionState } from "@livekit/components-react";
import { ConnectionState } from "livekit-client";
import { useEffect, useRef } from "react";
import { showCallNotice } from "@/features/room/client/call-notices";
import { directEntryNotice } from "@/features/room/domain/join";
import { useShortcutLabel } from "@/lib/hooks/use-shortcut-keys";

/**
 * After joining straight from "Chamar" or a ring, a pill says how the microphone came in
 * (as saved in "Entrar com microfone ligado") and which key switches it. Once per join.
 */
export function DirectEntryNotice({ micOn }: { micOn: boolean }) {
  const connected = useConnectionState() === ConnectionState.Connected;
  const key = useShortcutLabel("mic");
  const shown = useRef(false);
  useEffect(() => {
    if (!connected || shown.current) return;
    shown.current = true;
    showCallNotice(directEntryNotice(micOn, key), { id: "entrada-direta" });
  }, [connected, micOn, key]);
  return null;
}
