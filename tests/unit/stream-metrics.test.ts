import { expect, test } from "vitest";
import { readStreamMetrics } from "@/features/room/domain/stream-metrics";

test("reports video FPS and RTT from the selected connection, ignoring audio and stale pairs", () => {
  expect(
    readStreamMetrics([
      { type: "inbound-rtp", kind: "audio", framesPerSecond: 300 },
      { type: "inbound-rtp", kind: "video", framesPerSecond: 14.8 },
      { type: "transport", selectedCandidatePairId: "current" },
      { type: "candidate-pair", id: "old", currentRoundTripTime: 2 },
      { type: "candidate-pair", id: "current", currentRoundTripTime: 0.042 },
    ]),
  ).toEqual({ fps: 15, pingMs: 42 });
});

test("missing or invalid measurements stay unknown instead of showing invented zeroes", () => {
  expect(
    readStreamMetrics([null, { type: "inbound-rtp", kind: "video", framesPerSecond: NaN }]),
  ).toEqual({ fps: null, pingMs: null });
  expect(
    readStreamMetrics([
      { type: "outbound-rtp", kind: "video", framesPerSecond: 0 },
      { type: "candidate-pair", nominated: true, state: "succeeded", currentRoundTripTime: 0 },
    ]),
  ).toEqual({ fps: 0, pingMs: 0 });
});

test("a presenter's ping report is accepted only as a sane number for one screen", async () => {
  const { screenStatsSchema } = await import("@/features/room/domain/data-channel");
  expect(screenStatsSchema.safeParse({ trackSid: "TR_screen", pingMs: 42 }).success).toBe(true);
  expect(screenStatsSchema.safeParse({ trackSid: "TR_screen", pingMs: -1 }).success).toBe(false);
  expect(screenStatsSchema.safeParse({ trackSid: "TR_screen", pingMs: 1.5 }).success).toBe(false);
  expect(screenStatsSchema.safeParse({ trackSid: "", pingMs: 42 }).success).toBe(false);
  expect(screenStatsSchema.safeParse({ pingMs: 42 }).success).toBe(false);
});
