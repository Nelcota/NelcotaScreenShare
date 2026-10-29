import { beforeEach, expect, test, vi } from "vitest";
import { encodeMessage } from "@/features/room/domain/data-channel";
import { useViewerSounds } from "@/features/room/hooks/use-viewer-sounds";

type Receive = (message: { from?: { identity: string }; payload: Uint8Array }) => void;

const capture = vi.hoisted(() => ({
  screen: undefined as { trackSid: string } | undefined,
  receive: undefined as Receive | undefined,
  play: vi.fn(async () => {}),
  deafened: false,
}));

vi.mock("@livekit/components-react", () => ({
  useLocalParticipant: () => ({
    localParticipant: { getTrackPublication: () => capture.screen },
  }),
  useDataChannel: (_topic: string, receive: Receive) => {
    capture.receive = receive;
    return {};
  },
}));
vi.mock("@/features/room/audio/call-sounds", () => ({ playPeerSound: capture.play }));
vi.mock("@/features/room/ui/dock/Deafen", () => ({
  useDeafen: () => ({ deafened: capture.deafened }),
}));

beforeEach(() => {
  capture.screen = undefined;
  capture.receive = undefined;
  capture.deafened = false;
  capture.play.mockClear();
});

function deliver(notice: { trackSid: string; watching: boolean }, from = { identity: "bia" }) {
  if (!capture.receive) throw new Error("The data channel was not set up.");
  capture.receive({ from, payload: encodeMessage(notice) });
}

test("the sharer hears a viewer even when the screen started after the call drew", () => {
  // The call drew before sharing, and nothing redraws it when the screen is published.
  useViewerSounds();
  capture.screen = { trackSid: "TR_screen" };
  deliver({ trackSid: "TR_screen", watching: true });
  deliver({ trackSid: "TR_other", watching: false });
  expect(capture.play.mock.calls).toEqual([["viewer-joined"]]);
});

test("a notice with no sender makes no sound", () => {
  useViewerSounds();
  capture.screen = { trackSid: "TR_screen" };
  if (!capture.receive) throw new Error("The data channel was not set up.");
  capture.receive({ payload: encodeMessage({ trackSid: "TR_screen", watching: true }) });
  expect(capture.play).not.toHaveBeenCalled();
});

test("the sharer hears a viewer stop watching", () => {
  useViewerSounds();
  capture.screen = { trackSid: "TR_screen" };
  deliver({ trackSid: "TR_screen", watching: false });
  expect(capture.play.mock.calls).toEqual([["viewer-left"]]);
});

test("a sharer in Sem som still hears a viewer: it only stops the voices", () => {
  capture.deafened = true;
  useViewerSounds();
  capture.screen = { trackSid: "TR_screen" };
  deliver({ trackSid: "TR_screen", watching: true });
  expect(capture.play.mock.calls).toEqual([["viewer-joined"]]);
});
