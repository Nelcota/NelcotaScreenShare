import { useConnectionState, useRoomContext } from "@livekit/components-react";
import { ConnectionState, RoomEvent, Track } from "livekit-client";
import { createContext, use, useEffect, useEffectEvent, useState, type ReactNode } from "react";
import { callToast as toast } from "@/features/room/client/call-notices";
import { hostCommandAction } from "@/features/room/actions";
import {
  roomControlStateSchema,
  type HostIntent,
  type RoomControlState,
} from "@/features/room/domain/host-controls";
import type { LeaveNotice } from "@/features/room/domain/leave";
import { useOperation } from "@/lib/operations/use-operation";

interface HostControls {
  roomCode?: string;
  sessionId?: string;
  state?: RoomControlState;
  canShare: boolean;
  available: boolean;
  busy: boolean;
  execute: (intent: HostIntent) => void;
}
const RoomHostContext = createContext<HostControls>({
  canShare: true,
  available: false,
  busy: false,
  execute: () => {},
});
export function useRoomHost() {
  return use(RoomHostContext);
}

/** Stays mounted during navigation, alongside the persistent media connection. */
export function RoomHostProvider({
  code,
  sessionId,
  onLeave,
  children,
}: {
  code: string;
  sessionId?: string;
  onLeave: (notice?: LeaveNotice) => void;
  children: ReactNode;
}) {
  const room = useRoomContext();
  const connection = useConnectionState();
  const [state, setState] = useState<RoomControlState>();
  const [fresh, setFresh] = useState(false);
  const [screenPermission, setScreenPermission] = useState(true);
  const [revision, setRevision] = useState(0);
  const leave = useEffectEvent((removed: boolean) => {
    void room.disconnect();
    onLeave({
      reason: removed ? "removed" : "ended",
      message: removed
        ? "O anfitrião removeu você desta chamada."
        : state?.permanent
          ? "A chamada foi encerrada pelo anfitrião. O link continua disponível."
          : "A sala foi encerrada pelo anfitrião. Crie outra sala para continuar.",
    });
  });
  const command = useOperation(hostCommandAction, {
    onSuccess: ({ data }) => {
      setRevision((value) => value + 1);
      if (data.status === "failed") {
        toast.warning("A regra foi salva. A aplicação na chamada será tentada novamente.");
        return;
      }
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Não foi possível alterar a sala."),
  });

  useEffect(() => {
    if (connection !== ConnectionState.Connected) return;
    const update = () =>
      setScreenPermission(
        room.localParticipant.permissions?.canPublishSources.includes(
          Track.sourceToProto(Track.Source.ScreenShare),
        ) ?? false,
      );
    update();
    room.on(RoomEvent.ParticipantPermissionsChanged, update);
    return () => {
      room.off(RoomEvent.ParticipantPermissionsChanged, update);
    };
  }, [room, connection]);

  useEffect(() => {
    if (!sessionId || connection !== ConnectionState.Connected) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const response = await fetch(
          `/api/sala/controles?${new URLSearchParams({ room: code, sessionId, revision: String(revision) })}`,
          { signal: controller.signal },
        );
        if (!response.ok) {
          setFresh(false);
          return;
        }
        const result = roomControlStateSchema.safeParse(await response.json());
        if (!result.success || controller.signal.aborted) return;
        setState(result.data);
        setFresh(true);
        if (result.data.closed || result.data.removed) leave(result.data.removed);
      } catch {
        if (!controller.signal.aborted) setFresh(false);
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(() => void poll(), 2_000);
      }
    };
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [code, sessionId, connection, revision]);

  const available = Boolean(
    sessionId &&
    fresh &&
    state &&
    state.commands.length > 0 &&
    connection === ConnectionState.Connected &&
    !state.closed &&
    !state.removed,
  );
  return (
    <RoomHostContext
      value={{
        state,
        roomCode: code,
        sessionId,
        available,
        busy: command.isPending,
        canShare: !sessionId || Boolean(state?.canShare && screenPermission),
        execute: (intent) => {
          if (!available || !sessionId || command.isPending) return;
          command.execute({ ...intent, room: code, sessionId });
        },
      }}
    >
      {children}
    </RoomHostContext>
  );
}
