import {
  useLocalParticipant,
  useParticipantAttribute,
  useRoomContext,
} from "@livekit/components-react";
import { RoomEvent, type Participant } from "livekit-client";
import { useEffect, useState } from "react";
import { participantName } from "@/features/room/domain/participant-label";
import { roomDisplayName } from "@/features/room/domain/role-change";
import type { RoomTitle } from "@/features/room/domain/room-title";
import { parseRoomRole, ROLE_ATTRIBUTE, type RoomRole } from "@/features/room/domain/room-role";

function roleOf(participant: Participant): RoomRole {
  return parseRoomRole(participant.attributes[ROLE_ATTRIBUTE]);
}

/** The server's current room role, including promotions and demotions during the call. */
export function useLocalRoomRole(): RoomRole {
  const { localParticipant } = useLocalParticipant();
  return parseRoomRole(useParticipantAttribute(ROLE_ATTRIBUTE, { participant: localParticipant }));
}

/**
 * Re-renders when someone's role changes in the call (the server writes the attribute), so
 * badges and the room name follow a new moderator or owner without reloading.
 */
function useRoleChanges(): void {
  const room = useRoomContext();
  const [, setVersion] = useState(0);
  useEffect(() => {
    const bump = (changed: Record<string, string>) => {
      if (ROLE_ATTRIBUTE in changed) setVersion((version) => version + 1);
    };
    room.on(RoomEvent.ParticipantAttributesChanged, bump);
    return () => {
      room.off(RoomEvent.ParticipantAttributesChanged, bump);
    };
  }, [room]);
}

/**
 * A permanent room's own name, or "Sala de <dono>": the owner in the call when there is one,
 * else the name the page loaded.
 */
export function useRoomName(participants: Participant[], loaded: RoomTitle | null): string | null {
  useRoleChanges();
  const loadedText = loaded?.text ?? null;
  if (loaded && !loaded.followsOwner) return loadedText;
  const owner = participants.find((participant) => roleOf(participant) === "owner");
  if (!owner) return loadedText;
  return roomDisplayName(participantName(owner)) ?? loadedText;
}
