/** Signaling protocols the relay speaks to LiveKit: 16 by default, 17 for the current SDK. */
const SIGNAL_PROTOCOLS: ReadonlySet<string> = new Set(["16", "17"]);
export const DEFAULT_SIGNAL_PROTOCOL = "16";

/** Client options the relay passes on, each short; host, path and token are the server's. */
const CLIENT_OPTIONS = [
  "sdk",
  "version",
  "reconnect",
  "sid",
  "auto_subscribe",
  "adaptive_stream",
  "subscriber_primary",
] as const;
const MAX_OPTION_LENGTH = 128;

/**
 * What the relay copies from the browser's query to LiveKit. The protocol is one the relay
 * knows, or the default: the browser cannot pick an arbitrary one.
 */
export function clientSignalParams(supplied: URLSearchParams): [string, string][] {
  const params: [string, string][] = [];
  const protocol = supplied.get("protocol");
  params.push([
    "protocol",
    protocol !== null && SIGNAL_PROTOCOLS.has(protocol) ? protocol : DEFAULT_SIGNAL_PROTOCOL,
  ]);
  for (const key of CLIENT_OPTIONS) {
    const value = supplied.get(key);
    if (value !== null && value.length <= MAX_OPTION_LENGTH) params.push([key, value]);
  }
  return params;
}
