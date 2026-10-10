import { useRoomContext } from "@livekit/components-react";
import {
  ConnectionState,
  RoomEvent,
  Track,
  type RemoteParticipant,
  type RemoteTrackPublication,
} from "livekit-client";
import { useEffect } from "react";
import { toast } from "sonner";
import { participantName } from "@/features/room/domain/participant-label";

/**
 * Short notices of what happens in the room: who joined, who left and who
 * started or stopped showing their screen. They disappear on their own and need no click.
 */
export function useRoomNotices() {
  const room = useRoomContext();

  useEffect(() => {
    const participants = new Map<string, Set<string>>();

    // Joining and reconnecting load a snapshot, not new activity to announce.
    const synchronize = () => {
      participants.clear();
      for (const participant of room.remoteParticipants.values()) {
        const screens = [...participant.trackPublications.values()]
          .filter((publication) => publication.source === Track.Source.ScreenShare)
          .map((publication) => publication.trackSid);
        participants.set(participant.identity, new Set(screens));
      }
    };
    synchronize();

    const joined = (participant: RemoteParticipant) => {
      if (room.state !== ConnectionState.Connected) return;
      if (participants.has(participant.identity)) return;
      participants.set(participant.identity, new Set());
      toast(`${participantName(participant)} entrou na sala`, { duration: 3000 });
    };
    const left = (participant: RemoteParticipant) => {
      if (room.state !== ConnectionState.Connected) return;
      if (!participants.delete(participant.identity)) return;
      toast(`${participantName(participant)} saiu da sala`, { duration: 3000 });
    };
    const published = (publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      if (room.state !== ConnectionState.Connected) return;
      if (publication.source !== Track.Source.ScreenShare) return;
      const screens = participants.get(participant.identity);
      if (!screens || screens.has(publication.trackSid)) return;
      screens.add(publication.trackSid);
      toast(`${participantName(participant)} começou a mostrar a tela`, { duration: 3000 });
    };
    const unpublished = (publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      if (publication.source !== Track.Source.ScreenShare) return;
      // Someone leaving (or us disconnecting) also unpublishes: "saiu da sala" is enough.
      if (room.state !== ConnectionState.Connected) return;
      if (!room.remoteParticipants.has(participant.identity)) return;
      const screens = participants.get(participant.identity);
      if (!screens?.delete(publication.trackSid)) return;
      toast(`${participantName(participant)} parou de mostrar a tela`, { duration: 3000 });
    };

    room
      .on(RoomEvent.Connected, synchronize)
      .on(RoomEvent.Reconnected, synchronize)
      .on(RoomEvent.ParticipantConnected, joined)
      .on(RoomEvent.ParticipantDisconnected, left)
      .on(RoomEvent.TrackPublished, published)
      .on(RoomEvent.TrackUnpublished, unpublished);
    return () => {
      room
        .off(RoomEvent.Connected, synchronize)
        .off(RoomEvent.Reconnected, synchronize)
        .off(RoomEvent.ParticipantConnected, joined)
        .off(RoomEvent.ParticipantDisconnected, left)
        .off(RoomEvent.TrackPublished, published)
        .off(RoomEvent.TrackUnpublished, unpublished);
    };
  }, [room]);
}
