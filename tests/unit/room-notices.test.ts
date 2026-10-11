import { EventEmitter } from "node:events";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ConnectionState, RoomEvent, Track } from "livekit-client";
import { toast } from "sonner";
import { useRoomNotices } from "@/features/room/hooks/use-room-notices";

function participant(identity: string) {
  return { identity, name: identity, trackPublications: new Map() };
}

function screen(trackSid = "screen") {
  return { trackSid, source: Track.Source.ScreenShare };
}

type TestRoom = EventEmitter & {
  state: ConnectionState;
  remoteParticipants: Map<string, ReturnType<typeof participant>>;
};

const capture = vi.hoisted(() => ({
  room: undefined as TestRoom | undefined,
  cleanup: undefined as (() => void) | undefined,
}));

vi.mock("@livekit/components-react", () => ({ useRoomContext: () => capture.room }));
vi.mock("react", () => ({
  useEffect: (effect: () => (() => void) | undefined) => {
    capture.cleanup = effect();
  },
}));
vi.mock("sonner", () => ({ toast: vi.fn() }));

let room: TestRoom;

beforeEach(() => {
  room = Object.assign(new EventEmitter(), {
    state: ConnectionState.Connecting,
    remoteParticipants: new Map<string, ReturnType<typeof participant>>(),
  });
  capture.room = room;
  vi.clearAllMocks();
});

afterEach(() => capture.cleanup?.());

function RoomNoticesHarness() {
  useRoomNotices();
}

test("initial participants and screens are silent, including repeated synchronization events", () => {
  RoomNoticesHarness();
  const ana = participant("Ana");
  const share = screen();
  room.remoteParticipants.set(ana.identity, ana);
  ana.trackPublications.set(share.trackSid, share);
  room.emit(RoomEvent.ParticipantConnected, ana);
  room.emit(RoomEvent.TrackPublished, share, ana);
  room.state = ConnectionState.Connected;
  room.emit(RoomEvent.Connected);
  room.emit(RoomEvent.ParticipantConnected, ana);
  room.emit(RoomEvent.TrackPublished, share, ana);
  expect(toast).not.toHaveBeenCalled();
});

test("new joins, screen changes and departures are announced once, and rejoining still works", () => {
  room.state = ConnectionState.Connected;
  RoomNoticesHarness();
  const bia = participant("Bia");
  const share = screen();
  room.remoteParticipants.set(bia.identity, bia);
  for (let repeat = 0; repeat < 2; repeat += 1) {
    room.emit(RoomEvent.ParticipantConnected, bia);
    room.emit(RoomEvent.TrackPublished, share, bia);
  }
  room.emit(RoomEvent.TrackUnpublished, share, bia);
  room.emit(RoomEvent.TrackUnpublished, share, bia);
  room.remoteParticipants.delete(bia.identity);
  room.emit(RoomEvent.ParticipantDisconnected, bia);
  room.emit(RoomEvent.ParticipantDisconnected, bia);
  room.remoteParticipants.set(bia.identity, bia);
  room.emit(RoomEvent.ParticipantConnected, bia);
  expect(vi.mocked(toast).mock.calls.map(([message]) => message)).toEqual([
    "Bia entrou na sala",
    "Bia começou a mostrar a tela",
    "Bia parou de mostrar a tela",
    "Bia saiu da sala",
    "Bia entrou na sala",
  ]);
});

test("reconnection synchronizes the current room without replaying activity notices", () => {
  room.state = ConnectionState.Connected;
  RoomNoticesHarness();
  const caio = participant("Caio");
  const share = screen();
  room.state = ConnectionState.Reconnecting;
  room.remoteParticipants.set(caio.identity, caio);
  caio.trackPublications.set(share.trackSid, share);
  room.emit(RoomEvent.ParticipantConnected, caio);
  room.emit(RoomEvent.TrackPublished, share, caio);
  room.state = ConnectionState.Connected;
  room.emit(RoomEvent.Reconnected);
  room.emit(RoomEvent.ParticipantConnected, caio);
  room.emit(RoomEvent.TrackPublished, share, caio);
  expect(toast).not.toHaveBeenCalled();
  room.emit(RoomEvent.TrackUnpublished, share, caio);
  expect(toast).toHaveBeenCalledOnce();
});

test("disconnecting and departing participants do not produce screen-stop notices", () => {
  const ana = participant("Ana");
  const share = screen();
  ana.trackPublications.set(share.trackSid, share);
  room.remoteParticipants.set(ana.identity, ana);
  room.state = ConnectionState.Connected;
  RoomNoticesHarness();
  room.remoteParticipants.delete(ana.identity);
  room.emit(RoomEvent.TrackUnpublished, share, ana);
  room.state = ConnectionState.Disconnected;
  room.emit(RoomEvent.ParticipantDisconnected, ana);
  expect(toast).not.toHaveBeenCalled();
});

test("unmount removes all room notice listeners", () => {
  RoomNoticesHarness();
  capture.cleanup?.();
  expect(room.eventNames()).toEqual([]);
});
