import { useRoomContext } from "@livekit/components-react";
import {
  ConnectionState,
  RoomEvent,
  Track,
  type LocalTrackPublication,
  type RemoteParticipant,
  type RemoteTrackPublication,
} from "livekit-client";
import { useEffect, useEffectEvent, useState } from "react";
import { playCallSound, playPeerSound } from "@/features/room/audio/call-sounds";
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
 * started or stopped showing their screen, with a short sound for each ("Sons da chamada").
 * They disappear on their own and need no click.
 */
export function useRoomNotices() {
  const room = useRoomContext();
  const [welcome, setWelcome] = useState(0);
  // "Sem som" silences only the voices: these sounds follow "Sons da chamada" alone.
  const playPeer = useEffectEvent(
    (sound: "peer-joined" | "peer-left" | "screen-on" | "screen-off") => {
      void playPeerSound(sound);
    },
  );

  const playOwnScreen = useEffectEvent((sound: "screen-on" | "screen-off") => {
    void playCallSound(sound, false);
  });

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
      playPeer("peer-joined");
      setWelcome((previous) => previous + 1);
    };
    const left = (participant: RemoteParticipant) => {
      if (room.state !== ConnectionState.Connected) return;
      if (!participants.delete(participant.identity)) return;
      announce("left", participant);
      playPeer("peer-left");
    };
    const published = (publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      if (room.state !== ConnectionState.Connected) return;
      if (publication.source !== Track.Source.ScreenShare) return;
      const screens = participants.get(participant.identity);
      if (!screens || screens.has(publication.trackSid)) return;
      screens.add(publication.trackSid);
      showRoomNotice(`${participantName(participant)} começou a mostrar a tela`);
      playPeer("screen-on");
    };
    const unpublished = (publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      if (publication.source !== Track.Source.ScreenShare) return;
      // Someone leaving (or us disconnecting) also unpublishes: "saiu da sala" is enough.
      if (room.state !== ConnectionState.Connected) return;
      if (!room.remoteParticipants.has(participant.identity)) return;
      const screens = participants.get(participant.identity);
      if (!screens?.delete(publication.trackSid)) return;
      showRoomNotice(`${participantName(participant)} parou de mostrar a tela`);
      playPeer("screen-off");
    };
    // Your own screen: whichever way it started or stopped (the menu, the browser's bar).
    const ownPublished = (publication: LocalTrackPublication) => {
      if (publication.source === Track.Source.ScreenShare) playOwnScreen("screen-on");
    };
    const ownUnpublished = (publication: LocalTrackPublication) => {
      if (room.state !== ConnectionState.Connected) return;
      if (publication.source === Track.Source.ScreenShare) playOwnScreen("screen-off");
    };

    room
      .on(RoomEvent.Connected, synchronize)
      .on(RoomEvent.Reconnected, synchronize)
      .on(RoomEvent.ParticipantConnected, joined)
      .on(RoomEvent.ParticipantDisconnected, left)
      .on(RoomEvent.TrackPublished, published)
      .on(RoomEvent.TrackUnpublished, unpublished)
      .on(RoomEvent.LocalTrackPublished, ownPublished)
      .on(RoomEvent.LocalTrackUnpublished, ownUnpublished);
    return () => {
      room
        .off(RoomEvent.Connected, synchronize)
        .off(RoomEvent.Reconnected, synchronize)
        .off(RoomEvent.ParticipantConnected, joined)
        .off(RoomEvent.ParticipantDisconnected, left)
        .off(RoomEvent.TrackPublished, published)
        .off(RoomEvent.TrackUnpublished, unpublished)
        .off(RoomEvent.LocalTrackPublished, ownPublished)
        .off(RoomEvent.LocalTrackUnpublished, ownUnpublished);
    };
  }, [room]);

  return welcome;
}
