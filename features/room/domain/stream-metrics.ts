type StatsRecord = Record<string, unknown>;

/** One round trip to the media server, as the browser last measured it. */
export interface RoundTripSample {
  seconds: number;
  /** How many measurements the browser has made so far; null when it does not say. */
  count: number | null;
}

export interface StreamMetrics {
  fps: number | null;
  roundTrip: RoundTripSample | null;
}

/** A single measurement swings by hundreds of ms: the median of the last few is shown. */
const PING_WINDOW = 5;

function finiteNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return value;
}

function isRecord(value: unknown): value is StatsRecord {
  return typeof value === "object" && value !== null;
}

function isVideoRtp(record: StatsRecord): boolean {
  if (record.type !== "inbound-rtp" && record.type !== "outbound-rtp") return false;
  return record.kind === "video" || record.mediaType === "video";
}

function lastUsed(pairs: StatsRecord[]): StatsRecord | undefined {
  const usedAt = (pair: StatsRecord) => finiteNumber(pair.lastPacketReceivedTimestamp) ?? 0;
  return pairs.reduce<StatsRecord | undefined>(
    (best, pair) => (!best || usedAt(pair) > usedAt(best) ? pair : best),
    undefined,
  );
}

/**
 * The candidate pair carrying this track. Chrome and Safari name it in the transport;
 * Firefox flags it with `selected`. Pairs from another transport never count.
 */
function selectedPair(records: StatsRecord[], transportId: unknown): StatsRecord | undefined {
  const pairs = records.filter(
    (record) =>
      record.type === "candidate-pair" &&
      (transportId === undefined || record.transportId === transportId),
  );
  const transport = records.find(
    (record) =>
      record.type === "transport" &&
      typeof record.selectedCandidatePairId === "string" &&
      (transportId === undefined || record.id === transportId),
  );
  if (transport) return pairs.find((pair) => pair.id === transport.selectedCandidatePairId);
  const flagged = pairs.find((pair) => pair.selected === true);
  if (flagged) return flagged;
  const nominated = pairs.filter((pair) => pair.nominated === true && pair.state === "succeeded");
  return lastUsed(nominated);
}

/** Video rate and RTT to the media server, as reported by this browser's WebRTC connection. */
export function readStreamMetrics(report: Iterable<unknown>): StreamMetrics {
  const records = Array.from(report).filter(isRecord);
  const video = records.filter(isVideoRtp);
  const rates = video
    .map((record) => finiteNumber(record.framesPerSecond))
    .filter((rate): rate is number => rate !== null);
  const transportId = video.find((record) => typeof record.transportId === "string")?.transportId;
  const pair = selectedPair(records, transportId);
  // Not RTCP: through the media server it reads over 100 ms too high, even on localhost.
  const seconds = finiteNumber(pair?.currentRoundTripTime);
  return {
    fps: rates.length > 0 ? Math.round(Math.max(...rates)) : null,
    roundTrip: seconds === null ? null : { seconds, count: finiteNumber(pair?.responsesReceived) },
  };
}

/** With an even count, the lower middle value: spikes only ever go up. */
function lowerMedian(values: readonly number[]): number {
  const sorted = values.toSorted((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)] ?? 0;
}

/**
 * Turns raw samples into the ping to show, in ms. Reading the stats again before the
 * browser measures again returns the same sample: it is counted once.
 */
export function createPingTracker(windowSize: number = PING_WINDOW) {
  let recent: readonly number[] = [];
  let lastCount: number | null = null;
  return (sample: RoundTripSample | null): number | null => {
    if (!sample) return null;
    const repeated = sample.count !== null && sample.count === lastCount;
    lastCount = sample.count;
    if (!repeated) recent = [...recent, sample.seconds].slice(-windowSize);
    return Math.round(lowerMedian(recent) * 1000);
  };
}
