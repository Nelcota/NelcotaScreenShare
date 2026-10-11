import { RoomContext } from "@livekit/components-react";
import { useState } from "react";
import { useRoomConnection } from "@/features/room/hooks/use-room-connection";
import { DeafenProvider } from "@/features/room/ui/dock/Deafen";
import { ReactionsProvider } from "@/features/room/ui/dock/Reactions";
import type { JoinChoices } from "@/features/room/domain/join";
import type { LeaveNotice } from "@/features/room/domain/leave";
import { ShortcutScope, ShortcutSettings } from "@/lib/hooks/use-shortcut";
import { ConnectError } from "./ConnectError";
import { MinimizedCall } from "./MinimizedCall";
import { RoomLayout } from "./RoomLayout";

interface RoomViewProps {
  code: string;
  choices: JoinChoices;
  maxParticipants: number;
  /** Shows the link to the admin panel. */
  isAdmin: boolean;
  /** Another page is open: the call goes on hidden, with a card to go back. */
  minimized: boolean;
  onLeave: (notice?: LeaveNotice) => void;
  onRetry: () => Promise<void>;
}

/** Connects to the room and shows the call (or the failure screen, with "Tentar de novo"). */
export function RoomView({
  code,
  choices,
  maxParticipants,
  isAdmin,
  minimized,
  onLeave,
  onRetry,
}: RoomViewProps) {
  const { room, connectError, leave } = useRoomConnection(choices, onLeave);
  const [shortcutsEnabled, setShortcutsEnabled] = useState(true);

  if (connectError) {
    return (
      <div hidden={minimized}>
        <ConnectError
          message={connectError}
          onRetry={onRetry}
          onBack={() =>
            onLeave({
              reason: "failed",
              message: "Não foi possível conectar. Tente entrar de novo.",
            })
          }
        />
      </div>
    );
  }

  // Hidden, not unmounted: the connection, the audio and the shared screen stay on.
  return (
    <RoomContext.Provider value={room}>
      <DeafenProvider>
        <ShortcutSettings value={{ enabled: shortcutsEnabled, setEnabled: setShortcutsEnabled }}>
          <ShortcutScope value={!minimized}>
            <div hidden={minimized}>
              <ReactionsProvider>
                <RoomLayout
                  code={code}
                  maxParticipants={maxParticipants}
                  isAdmin={isAdmin}
                  onLeave={leave}
                />
              </ReactionsProvider>
            </div>
          </ShortcutScope>
        </ShortcutSettings>
        {minimized ? <MinimizedCall code={code} /> : null}
      </DeafenProvider>
    </RoomContext.Provider>
  );
}
