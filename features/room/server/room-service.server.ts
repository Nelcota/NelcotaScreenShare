import { RoomServiceClient } from "livekit-server-sdk";
import { getEnv } from "@/server/env.server";

function httpUrlFrom(wsUrl: string): string {
  const url = new URL(wsUrl);
  url.protocol = url.protocol === "wss:" ? "https:" : "http:";
  return url.origin;
}

let cached: { key: string; client: RoomServiceClient } | undefined;

/**
 * LiveKit admin API (same keys as the token). One client for the process: every call
 * used to build a new one. A change of address or keys (tests) builds it again.
 */
export function roomService(): RoomServiceClient {
  const env = getEnv();
  const key = `${env.LIVEKIT_URL}\n${env.LIVEKIT_API_KEY}\n${env.LIVEKIT_API_SECRET}`;
  if (cached?.key === key) return cached.client;
  const client = new RoomServiceClient(
    httpUrlFrom(env.LIVEKIT_URL),
    env.LIVEKIT_API_KEY,
    env.LIVEKIT_API_SECRET,
    { requestTimeout: 4 },
  );
  cached = { key, client };
  return client;
}
