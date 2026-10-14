import type { RoomTitle } from "@/features/room/domain/room-title";
import { RoomContext } from "@livekit/components-react";
import { useState } from "react";
import { useAnnounceCall } from "@/features/room/hooks/use-call-tabs";
import { useRoomConnection } from "@/features/room/hooks/use-room-connection";
import { playCallSound } from "@/features/room/audio/call-sounds";
import { useApplyMediaSettings } from "@/features/room/hooks/use-apply-media-settings";
import { OTHER_TAB_TOOK_OVER } from "@/features/room/domain/room-switch";
import { DeafenProvider } from "@/features/room/ui/dock/Deafen";
import { MicTestProvider } from "@/features/room/ui/dock/MicTest";
import { ScreenWatchProvider } from "@/features/room/hooks/use-screen-watch";
import { ReactionsProvider } from "@/features/room/ui/dock/Reactions";
import type { JoinChoices } from "@/features/room/domain/join";
import type { LeaveNotice } from "@/features/room/domain/leave";
import { ShortcutScope, ShortcutSettings } from "@/lib/hooks/use-shortcut";
import { ConnectError } from "./ConnectError";
import { MinimizedCall } from "./MinimizedCall";
import { CallToaster } from "./CallToaster";
import { RoomLayout } from "./RoomLayout";
import { RoomHostProvider } from "./RoomHostProvider";

interface RoomViewProps {
  code: string;
  choices: JoinChoices;
  maxParticipants: number;
  roomName: RoomTitle | null;
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
  roomName,
  isAdmin,
  minimized,
  onLeave,
  onRetry,
}: RoomViewProps) {
  const { room, connectError, leave } = useRoomConnection(choices, code, onLeave);
  // "Sair" (dock or minimized card): your own sound, unlike someone else leaving.
  const leaveOnPurpose = () => {
    void playCallSound("leave");
    leave();
  };
  useApplyMediaSettings(room);
  const [shortcutsEnabled, setShortcutsEnabled] = useState(true);
  // Another tab of this browser joined a call: this one leaves, with the reason on screen.
  useAnnounceCall(code, () => leave(OTHER_TAB_TOOK_OVER));

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
      <RoomHostProvider code={code} sessionId={choices.sessionId} onLeave={onLeave}>
        <ScreenWatchProvider>
          <DeafenProvider>
            <MicTestProvider>
              <ShortcutSettings
                value={{ enabled: shortcutsEnabled, setEnabled: setShortcutsEnabled }}
              >
                <ShortcutScope value={!minimized}>
                  <div hidden={minimized}>
                    <ReactionsProvider>
                      <RoomLayout
                        code={code}
                        maxParticipants={maxParticipants}
                        roomName={roomName}
                        isAdmin={isAdmin}
                        onLeave={leaveOnPurpose}
                      />
                    </ReactionsProvider>
                  </div>
                </ShortcutScope>
              </ShortcutSettings>
              {minimized ? <MinimizedCall code={code} onLeave={leaveOnPurpose} /> : <CallToaster />}
            </MicTestProvider>
          </DeafenProvider>
        </ScreenWatchProvider>
      </RoomHostProvider>
    </RoomContext.Provider>
  );
}
