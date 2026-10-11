import { StreamerModeProvider } from "@/features/room/hooks/use-streamer-mode";
import { useHiddenRoomAddress } from "@/features/room/hooks/use-hidden-room-address";
import { useState } from "react";
import type { RoomPresence } from "@/features/room/domain/presence";
import { RoomSession } from "./RoomSession";

/** What the room page loads (`/sala/:codigo`). */
export interface RoomEntry {
  code: string;
  /** Signed-in account, or null for a guest who joins through the link. */
  user: { name: string; image: string | null } | null;
  passwordRequired: boolean;
  invite?: string;
  maxParticipants: number;
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
export function ActiveRoom({ room }: { room: RoomEntry | undefined }) {
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
        userName={entry.user?.name ?? null}
        userImage={entry.user?.image ?? null}
        passwordRequired={entry.passwordRequired}
        invite={entry.invite}
        maxParticipants={entry.maxParticipants}
        presence={entry.presence}
        isAdmin={entry.isAdmin}
        minimized={room === undefined}
        onCallChange={(inCall) => setCall(inCall ? entry : undefined)}
      />
    </StreamerModeProvider>
  );
}
