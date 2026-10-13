import { StreamerModeProvider } from "@/features/room/hooks/use-streamer-mode";
import { useHiddenRoomAddress } from "@/features/room/hooks/use-hidden-room-address";
import { useState, type ReactNode } from "react";
import type { RoomPresence } from "@/features/room/domain/presence";
import { RoomSession } from "./RoomSession";

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
  /** "Sala de Ana", from the owner; null when the room has no owner. */
  roomName: string | null;
  presence: RoomPresence | null;
  isAdmin: boolean;
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
  const entry = room ?? call;
  if (entry === undefined) return null;

  return (
    <StreamerModeProvider>
      <HiddenRoomAddress entry={entry} active={room !== undefined} />
      <RoomSession
        // Another room drops the current call.
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
        isAdmin={entry.isAdmin}
        minimized={room === undefined}
        renderColumn={room === undefined ? undefined : renderColumn}
        onCallChange={(inCall) => setCall(inCall ? entry : undefined)}
      />
    </StreamerModeProvider>
  );
}
