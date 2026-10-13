import { expect, test } from "vitest";
import { createPingTracker, readStreamMetrics } from "@/features/room/domain/stream-metrics";

test("reports video FPS and RTT from the selected connection, ignoring audio and stale pairs", () => {
  expect(
    readStreamMetrics([
      { type: "inbound-rtp", kind: "audio", framesPerSecond: 300 },
      { type: "inbound-rtp", kind: "video", framesPerSecond: 14.8 },
      { type: "transport", selectedCandidatePairId: "current" },
      { type: "candidate-pair", id: "old", currentRoundTripTime: 2 },
      { type: "candidate-pair", id: "current", currentRoundTripTime: 0.042, responsesReceived: 9 },
    ]),
  ).toEqual({ fps: 15, roundTrip: { seconds: 0.042, count: 9 } });
});

test("missing or invalid measurements stay unknown instead of showing invented zeroes", () => {
  expect(
    readStreamMetrics([null, { type: "inbound-rtp", kind: "video", framesPerSecond: NaN }]),
  ).toEqual({ fps: null, roundTrip: null });
  expect(
    readStreamMetrics([
      { type: "outbound-rtp", kind: "video", framesPerSecond: 0 },
      { type: "candidate-pair", nominated: true, state: "succeeded", currentRoundTripTime: 0 },
    ]),
  ).toEqual({ fps: 0, roundTrip: { seconds: 0, count: null } });
});

test("Firefox: the pair flagged as selected wins over an older nominated pair", () => {
  expect(
    readStreamMetrics([
      { type: "inbound-rtp", kind: "video", transportId: "0" },
      {
        type: "candidate-pair",
        transportId: "0",
        nominated: true,
        state: "succeeded",
        selected: false,
        currentRoundTripTime: 0.9,
      },
      {
        type: "candidate-pair",
        transportId: "0",
        nominated: true,
        state: "succeeded",
        selected: true,
        currentRoundTripTime: 0.03,
      },
    ]).roundTrip?.seconds,
  ).toBe(0.03);
});

test("without a selection flag, the nominated pair that last received data wins", () => {
  expect(
    readStreamMetrics([
      {
        type: "candidate-pair",
        nominated: true,
        state: "succeeded",
        lastPacketReceivedTimestamp: 100,
        currentRoundTripTime: 0.9,
      },
      {
        type: "candidate-pair",
        nominated: true,
        state: "succeeded",
        lastPacketReceivedTimestamp: 500,
        currentRoundTripTime: 0.03,
      },
    ]).roundTrip?.seconds,
  ).toBe(0.03);
});

test("pairs and transports of another connection are ignored", () => {
  expect(
    readStreamMetrics([
      { type: "outbound-rtp", kind: "video", transportId: "T02" },
      { type: "transport", id: "T01", selectedCandidatePairId: "other" },
      { type: "transport", id: "T02", selectedCandidatePairId: "mine" },
      { type: "candidate-pair", id: "other", transportId: "T01", currentRoundTripTime: 0.5 },
      { type: "candidate-pair", id: "mine", transportId: "T02", currentRoundTripTime: 0.02 },
    ]).roundTrip?.seconds,
  ).toBe(0.02);
});

test("without RTT on the pair, RTCP reports are not used", () => {
  expect(
    readStreamMetrics([
      { type: "outbound-rtp", kind: "video", transportId: "0" },
      { type: "candidate-pair", transportId: "0", selected: true },
      { type: "remote-inbound-rtp", transportId: "0", roundTripTime: 0.13 },
    ]).roundTrip,
  ).toBeNull();
});

test("the ping shown is the median of recent measurements, so one spike does not show", () => {
  const trackPing = createPingTracker();
  expect(trackPing({ seconds: 0.004, count: 1 })).toBe(4);
  expect(trackPing({ seconds: 0.358, count: 2 })).toBe(4);
  expect(trackPing({ seconds: 0.014, count: 3 })).toBe(14);
  expect(trackPing({ seconds: 0.632, count: 4 })).toBe(14);
  expect(trackPing({ seconds: 0.005, count: 5 })).toBe(14);
  expect(trackPing({ seconds: 0.016, count: 6 })).toBe(16);
});

test("reading the same measurement twice counts it once", () => {
  const trackPing = createPingTracker();
  trackPing({ seconds: 0.01, count: 1 });
  trackPing({ seconds: 0.01, count: 1 });
  trackPing({ seconds: 0.01, count: 1 });
  expect(trackPing({ seconds: 0.5, count: 2 })).toBe(10);
  expect(trackPing(null)).toBeNull();
});

test("a presenter's ping report is accepted only as a sane number for one screen", async () => {
  const { screenStatsSchema } = await import("@/features/room/domain/data-channel");
  expect(screenStatsSchema.safeParse({ trackSid: "TR_screen", pingMs: 42 }).success).toBe(true);
  expect(screenStatsSchema.safeParse({ trackSid: "TR_screen", pingMs: -1 }).success).toBe(false);
  expect(screenStatsSchema.safeParse({ trackSid: "TR_screen", pingMs: 1.5 }).success).toBe(false);
  expect(screenStatsSchema.safeParse({ trackSid: "", pingMs: 42 }).success).toBe(false);
  expect(screenStatsSchema.safeParse({ pingMs: 42 }).success).toBe(false);
});
