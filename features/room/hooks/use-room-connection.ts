import { controlledDisconnectNotice } from "@/features/room/client/disconnect-notice";
import { useSequentialRoomConnectDisconnect } from "@livekit/components-react";
import { DisconnectReason, Room, RoomEvent, VideoPresets } from "livekit-client";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { toast } from "sonner";
import { savedAudioProcessing, savedCamera, savedOutput } from "@/features/room/client/saved-media";
import {
  connectErrorMessage,
  disconnectMessage,
  disconnectReason,
} from "@/features/room/client/connection-errors";
import type { LeaveNotice } from "@/features/room/domain/leave";
import type { JoinChoices } from "@/features/room/domain/join";
import { roomMicErrorMessage } from "@/features/room/client/microphone-errors";
import { MIC_ERROR_TOAST } from "@/features/room/client/toast-ids";
import { logBrowserWarning, runAndReport } from "@/lib/telemetry.client";

/**
 * Room connection lifecycle: creates the Room, connects, turns on the requested
 * microphone, reports reconnection and drops, and disconnects on leave or unmount.
 * `connectError`: the connection never opened (the screen offers "Tentar de novo").
 */
export function useRoomConnection(
  choices: JoinChoices,
  code: string,
  /** No notice: the person left on purpose. */
  onLeave: (notice?: LeaveNotice) => void,
): {
  room: Room;
  connectError: string | undefined;
  /** No notice: the person left on purpose. */
  leave: (notice?: LeaveNotice) => void;
} {
  const [room] = useState(
    () =>
      new Room({
        adaptiveStream: true,
        dynacast: true,
        // Light next to a shared screen; simulcast sends smaller layers to small tiles.
        videoCaptureDefaults: {
          resolution: VideoPresets.h360.resolution,
          deviceId: savedCamera(),
        },
        // Choices from "Áudio e vídeo" in the account (this browser).
        audioCaptureDefaults: { deviceId: choices.audioDeviceId, ...savedAudioProcessing() },
        audioOutput: { deviceId: savedOutput() },
      }),
  );
  const { connect, disconnect } = useSequentialRoomConnectDisconnect(room);
  const [connectError, setConnectError] = useState<string>();
  const leavingRef = useRef(false);
  const activeRef = useRef(true);

  const handleUnexpectedDisconnect = useEffectEvent((reason?: DisconnectReason) => {
    if (leavingRef.current || reason === DisconnectReason.CLIENT_INITIATED) return;
    const fallback: LeaveNotice = {
      reason: disconnectReason(reason),
      message:
        disconnectMessage(reason) ??
        "Você foi desconectado. Verifique sua internet e entre de novo.",
    };
    void controlledDisconnectNotice(code, choices.sessionId, fallback).then((notice) => {
      if (activeRef.current && !leavingRef.current) onLeave(notice);
    });
  });

  useEffect(() => {
    activeRef.current = true;
    let cancelled = false;
    // Until connect() finishes, the catch below handles failure: the SDK
    // also emits Disconnected when the connection never opens, and that
    // would lead to the "Você saiu da sala" screen instead of "Tentar de novo".
    let connected = false;

    const handleDisconnected = (reason?: DisconnectReason) => {
      if (!cancelled && connected) handleUnexpectedDisconnect(reason);
    };
    const handleReconnected = () => toast.success("Conexão restabelecida.");
    // Microphone failures only (screen sharing has its own notices).
    const handleMediaError = (error: Error, kind?: MediaDeviceKind) => {
      if (kind !== "audioinput") return;
      toast.error(roomMicErrorMessage(error), { id: MIC_ERROR_TOAST });
    };

    room
      .on(RoomEvent.Disconnected, handleDisconnected)
      .on(RoomEvent.Reconnected, handleReconnected)
      .on(RoomEvent.MediaDevicesError, handleMediaError);

    const run = async () => {
      setConnectError(undefined);
      try {
        // Screens come only when the person chooses to watch (ScreenWatchProvider).
        await connect(choices.serverUrl, choices.token, { autoSubscribe: false });
        if (cancelled) return;
        connected = true;
        if (choices.micEnabled) {
          await room.localParticipant.setMicrophoneEnabled(true).catch((error: unknown) => {
            logBrowserWarning("Could not turn on the microphone on join", error);
            toast.error(
              "Você entrou com o microfone desligado. Confira as permissões do site e ligue pelos controles da sala.",
              { id: MIC_ERROR_TOAST },
            );
          });
        }
      } catch (error) {
        if (!cancelled) setConnectError(connectErrorMessage(error));
      }
    };
    void run();

    return () => {
      cancelled = true;
      activeRef.current = false;
      room
        .off(RoomEvent.Disconnected, handleDisconnected)
        .off(RoomEvent.Reconnected, handleReconnected)
        .off(RoomEvent.MediaDevicesError, handleMediaError);
      void runAndReport(disconnect);
    };
  }, [room, connect, disconnect, choices]);

  function leave(notice?: LeaveNotice) {
    leavingRef.current = true;
    void disconnectAndLeave(notice);
  }

  async function disconnectAndLeave(notice?: LeaveNotice) {
    await runAndReport(disconnect);
    onLeave(notice);
  }

  return { room, connectError, leave };
}
