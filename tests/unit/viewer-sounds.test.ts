import { beforeEach, expect, test, vi } from "vitest";
import { encodeMessage } from "@/features/room/domain/data-channel";
import { useViewerSounds } from "@/features/room/hooks/use-viewer-sounds";

const capture = vi.hoisted(() => ({
  screen: undefined as { trackSid: string } | undefined,
  receive: undefined as ((message: { payload: Uint8Array }) => void) | undefined,
  play: vi.fn(async () => {}),
}));

vi.mock("@livekit/components-react", () => ({
  useLocalParticipant: () => ({
    localParticipant: { getTrackPublication: () => capture.screen },
  }),
  useDataChannel: (_topic: string, receive: (message: { payload: Uint8Array }) => void) => {
    capture.receive = receive;
    return {};
  },
}));
vi.mock("@/features/room/audio/call-sounds", () => ({ playPeerSound: capture.play }));
vi.mock("@/features/room/ui/dock/Deafen", () => ({ useDeafen: () => ({ deafened: false }) }));

beforeEach(() => {
  capture.screen = undefined;
  capture.receive = undefined;
  capture.play.mockClear();
});

function deliver(notice: { trackSid: string; watching: boolean }) {
  if (!capture.receive) throw new Error("The data channel was not set up.");
  capture.receive({ payload: encodeMessage(notice) });
}

test("the sharer hears a viewer even when the screen started after the call drew", () => {
  // The call drew before sharing, and nothing redraws it when the screen is published.
  useViewerSounds();
  capture.screen = { trackSid: "TR_screen" };
  deliver({ trackSid: "TR_screen", watching: true });
  deliver({ trackSid: "TR_other", watching: false });
  expect(capture.play.mock.calls).toEqual([["viewer-joined"]]);
});
