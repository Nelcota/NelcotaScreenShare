import { RoomServiceClient } from "livekit-server-sdk";
import { getEnv } from "@/server/env.server";

function httpUrlFrom(wsUrl: string): string {
  const url = new URL(wsUrl);
  url.protocol = url.protocol === "wss:" ? "https:" : "http:";
  return url.origin;
}

/** LiveKit admin API (same keys as the token). */
export function roomService(): RoomServiceClient {
  const env = getEnv();
  return new RoomServiceClient(
    httpUrlFrom(env.LIVEKIT_URL),
    env.LIVEKIT_API_KEY,
    env.LIVEKIT_API_SECRET,
    { requestTimeout: 4 },
  );
}
