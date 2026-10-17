import { expect, test, vi } from "vitest";
import { Track, type Room } from "livekit-client";
import { decodeMessage, screenWatchSchema, TOPICS } from "@/features/room/domain/data-channel";
import { noticeWatching } from "@/features/room/client/screen-watch-notice";

vi.mock("@/lib/telemetry.client", () => ({ logBrowserWarning: vi.fn() }));

function roomWith(sharers: Record<string, string>) {
  const publishData = vi.fn<(payload: Uint8Array, options: object) => Promise<void>>();
  publishData.mockResolvedValue(undefined);
  const remoteParticipants = new Map(
    Object.entries(sharers).map(([identity, trackSid]) => [
      identity,
      {
        identity,
        getTrackPublication: (source: Track.Source) =>
          source === Track.Source.ScreenShare ? { trackSid } : undefined,
      },
    ]),
  );
  const room = { remoteParticipants, localParticipant: { publishData } } as unknown as Room;
  return { room, publishData };
}

test("starting to watch tells only that screen's sharer", async () => {
  const { room, publishData } = roomWith({ ana: "TR_ana", beto: "TR_beto" });
  await noticeWatching(room, "TR_beto", true);
  expect(publishData).toHaveBeenCalledOnce();
  const [payload, options] = publishData.mock.calls[0] ?? [];
  expect(options).toEqual({
    reliable: true,
    topic: TOPICS.screenWatch,
    destinationIdentities: ["beto"],
  });
  expect(decodeMessage(payload ?? new Uint8Array(), screenWatchSchema)).toEqual({
    trackSid: "TR_beto",
    watching: true,
  });
});

test("a screen whose sharer already left sends nothing", async () => {
  const { room, publishData } = roomWith({ ana: "TR_ana" });
  await noticeWatching(room, "TR_gone", false);
  expect(publishData).not.toHaveBeenCalled();
});
