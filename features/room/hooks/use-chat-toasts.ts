import { useRoomContext } from "@livekit/components-react";
import { RoomEvent, type Participant } from "livekit-client";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { showCallNotice } from "@/features/room/client/call-notices";

interface ChatToast {
  id: string;
  author: Participant | undefined;
  text: string;
}

/**
 * New-message notices during a call: a pill at the top right that clicks pass through (the
 * chat opens from the dock, or with C), removed when their author leaves the room (or the
 * call ends), since a message from someone who is gone is old news.
 */
export function useChatToasts() {
  const room = useRoomContext();
  const shownByAuthor = useRef(new Map<string | undefined, Set<string>>());

  useEffect(() => {
    const shown = shownByAuthor.current;
    const dismissFrom = (participant: Participant) => {
      const ids = shown.get(participant.identity);
      if (!ids) return;
      for (const id of ids) toast.dismiss(id);
      shown.delete(participant.identity);
    };
    const dismissAll = () => {
      for (const ids of shown.values()) {
        for (const id of ids) toast.dismiss(id);
      }
      shown.clear();
    };
    room.on(RoomEvent.ParticipantDisconnected, dismissFrom).on(RoomEvent.Disconnected, dismissAll);
    return () => {
      room
        .off(RoomEvent.ParticipantDisconnected, dismissFrom)
        .off(RoomEvent.Disconnected, dismissAll);
      dismissAll();
    };
  }, [room]);

  // Stable across renders: it only touches the ref, so effects can depend on it.
  return useCallback(({ id, author, text }: ChatToast) => {
    const identity = author?.identity;
    const ids = shownByAuthor.current.get(identity) ?? new Set<string>();
    shownByAuthor.current.set(identity, ids.add(id));
    const release = () => {
      const shown = shownByAuthor.current;
      const current = shown.get(identity);
      if (!current) return;
      current.delete(id);
      if (current.size === 0) shown.delete(identity);
    };
    showCallNotice(text, { id, onDismiss: release, onAutoClose: release });
  }, []);
}
