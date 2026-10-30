import type { RoomTitle } from "@/features/room/domain/room-title";
import { StreamerModeProvider } from "@/features/room/hooks/use-streamer-mode";
import { useHiddenRoomAddress } from "@/features/room/hooks/use-hidden-room-address";
import { useEffect, useState, type ReactNode } from "react";
import type { RoomPresence } from "@/features/room/domain/presence";
import { setActiveCallCode } from "@/features/room/hooks/use-active-call";
import { useLeaveCallWarning } from "@/features/room/hooks/use-leave-call-warning";
import { useRoomSwitchGuard } from "@/features/room/hooks/use-room-switch-guard";
import { RoomSession } from "./RoomSession";
import { RoomSwitchDialog } from "./RoomSwitchDialog";

/** What the room page loads (`/sala/:codigo`). */
export interface RoomEntry {
  code: string;
  unavailable?: string;
  permanent?: boolean;
  /** Signed-in account, or null for a guest who joins through the link. */
  user: { name: string; image: string | null } | null;
  passwordRequired: boolean;
  invite?: string;
  maxParticipants: number;
  /** The room's own name, or "Sala de Ana" from the owner; null when it has neither. */
  roomName: RoomTitle | null;
  presence: RoomPresence | null;
  panelShortcut: boolean;
}

/** Streamer mode: the address bar shows `/sala` while the room page is open. */
function HiddenRoomAddress({ entry, active }: { entry: RoomEntry; active: boolean }) {
  useHiddenRoomAddress(entry.code, entry.invite, active);
  return null;
}

/**
 * The room lives above the routes, so a call survives navigation: on the room page
 * it fills the screen; on any other page (the admin panel) it goes on minimized
 * until the person comes back. Outside a call, leaving the page discards it.
 * Going to another room during a call asks first: confirming leaves this call.
 * `room`: the room page's data when it is the current page.
 */
export function ActiveRoom({
  room,
  renderColumn,
}: {
  room: RoomEntry | undefined;
  /** The app's friends column (signed in), drawn by the app: the room has no friends UI. */
  renderColumn?: (inCall: boolean) => ReactNode;
}) {
  const [call, setCall] = useState<RoomEntry>();
  const pendingSwitch = useRoomSwitchGuard(call?.code, () => setCall(undefined));
  // Pages outside the room (the start's bar) offer the way back while the call goes on.
  const activeCode = call?.code;
  useEffect(() => {
    setActiveCallCode(activeCode);
    return () => setActiveCallCode(undefined);
  }, [activeCode]);
  useLeaveCallWarning(activeCode !== undefined);
  // The room page's latest data (a new owner's name, who is inside) replaces the one saved at
  // joining, so the minimized call does not show it stale.
  if (room && call && room !== call && room.code === call.code) setCall(room);
  const entry = room ?? call;
  if (entry === undefined) return null;

  return (
    <StreamerModeProvider>
      <HiddenRoomAddress entry={entry} active={room !== undefined} />
      <RoomSession
        // Another room drops the current call: unmounting disconnects it (mic and screen stop).
        key={entry.code}
        code={entry.code}
        unavailable={entry.unavailable}
        permanent={entry.permanent}
        userName={entry.user?.name ?? null}
        userImage={entry.user?.image ?? null}
        passwordRequired={entry.passwordRequired}
        invite={entry.invite}
        maxParticipants={entry.maxParticipants}
        roomName={entry.roomName}
        presence={entry.presence}
        panelShortcut={entry.panelShortcut}
        minimized={room === undefined}
        renderColumn={room === undefined ? undefined : renderColumn}
        onCallChange={(inCall) => setCall(inCall ? entry : undefined)}
      />
      <RoomSwitchDialog pending={pendingSwitch} />
    </StreamerModeProvider>
  );
}
