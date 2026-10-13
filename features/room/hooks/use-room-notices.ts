import { useRoomContext } from "@livekit/components-react";
import {
  ConnectionState,
  RoomEvent,
  Track,
  type RemoteParticipant,
  type RemoteTrackPublication,
} from "livekit-client";
import { useEffect } from "react";
import {
  addToNoticeGroup,
  noticeGroupMessage,
  type GroupedNoticeKind,
  type NoticeGroup,
} from "@/features/room/domain/notice-grouping";
import { participantName } from "@/features/room/domain/participant-label";
import { showCallNotice } from "@/features/room/client/call-notices";

function showRoomNotice(message: string) {
  showCallNotice(message);
}

/** One toast per kind: a newer group replaces the visible one instead of stacking another. */
function showGroupedNotice(group: NoticeGroup) {
  showCallNotice(noticeGroupMessage(group), { id: `room-notice-${group.kind}` });
}

/**
 * Short notices of what happens in the room: who joined, who left and who
 * started or stopped showing their screen. They disappear on their own and need no click.
 */
export function useRoomNotices() {
  const room = useRoomContext();

  useEffect(() => {
    const participants = new Map<string, Set<string>>();
    const groups = new Map<GroupedNoticeKind, NoticeGroup>();

    const announce = (kind: GroupedNoticeKind, participant: RemoteParticipant) => {
      const person = { identity: participant.identity, name: participantName(participant) };
      const group = addToNoticeGroup(groups.get(kind), kind, person, Date.now());
      groups.set(kind, group);
      showGroupedNotice(group);
    };

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
      announce("joined", participant);
    };
    const left = (participant: RemoteParticipant) => {
      if (room.state !== ConnectionState.Connected) return;
      if (!participants.delete(participant.identity)) return;
      announce("left", participant);
    };
    const published = (publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      if (room.state !== ConnectionState.Connected) return;
      if (publication.source !== Track.Source.ScreenShare) return;
      const screens = participants.get(participant.identity);
      if (!screens || screens.has(publication.trackSid)) return;
      screens.add(publication.trackSid);
      showRoomNotice(`${participantName(participant)} começou a mostrar a tela`);
    };
    const unpublished = (publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      if (publication.source !== Track.Source.ScreenShare) return;
      // Someone leaving (or us disconnecting) also unpublishes: "saiu da sala" is enough.
      if (room.state !== ConnectionState.Connected) return;
      if (!room.remoteParticipants.has(participant.identity)) return;
      const screens = participants.get(participant.identity);
      if (!screens?.delete(publication.trackSid)) return;
      showRoomNotice(`${participantName(participant)} parou de mostrar a tela`);
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
