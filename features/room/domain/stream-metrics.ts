export interface StreamMetrics {
  fps: number | null;
  pingMs: number | null;
}

function finiteNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return value;
}

/** Video rate and RTT to the media server, as reported by this viewer's WebRTC connection. */
export function readStreamMetrics(report: Iterable<unknown>): StreamMetrics {
  const records = Array.from(report).filter(
    (value): value is Record<string, unknown> => typeof value === "object" && value !== null,
  );
  const video = records.filter(
    (record) =>
      (record.type === "inbound-rtp" || record.type === "outbound-rtp") &&
      (record.kind === "video" || record.mediaType === "video"),
  );
  const rates = video
    .map((record) => finiteNumber(record.framesPerSecond))
    .filter((rate): rate is number => rate !== null);
  const transport = records.find(
    (record) => record.type === "transport" && typeof record.selectedCandidatePairId === "string",
  );
  const pair = records.find(
    (record) =>
      record.type === "candidate-pair" &&
      (transport
        ? record.id === transport.selectedCandidatePairId
        : record.nominated === true && record.state === "succeeded"),
  );
  const roundTrip = finiteNumber(pair?.currentRoundTripTime);
  return {
    fps: rates.length > 0 ? Math.round(Math.max(...rates)) : null,
    pingMs: roundTrip === null ? null : Math.round(roundTrip * 1000),
  };
}
