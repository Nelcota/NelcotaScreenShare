import { expect, test, vi } from "vitest";

const env = vi.hoisted(() => ({
  LIVEKIT_URL: "ws://127.0.0.1:7880",
  LIVEKIT_API_KEY: "devkey",
  LIVEKIT_API_SECRET: "devsecret-0123456789abcdef0123456789abcdef",
}));
vi.mock("@/server/env.server", () => ({ getEnv: () => env }));
const { roomService } = await import("@/features/room/server/room-service.server");

test("one LiveKit client for the process, rebuilt only when the address or keys change", () => {
  const first = roomService();
  expect(roomService()).toBe(first);
  env.LIVEKIT_URL = "ws://127.0.0.1:7890";
  expect(roomService()).not.toBe(first);
});
