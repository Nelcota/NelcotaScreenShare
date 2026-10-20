import { beforeEach, expect, test, vi } from "vitest";
import type * as React from "react";

const state = vi.hoisted(() => ({ streamBytes: vi.fn() }));
vi.mock("react", async (original) => ({
  ...(await original<typeof React>()),
  useEffect: () => {},
  useEffectEvent: (callback: unknown) => callback,
  useRef: (current: unknown) => ({ current }),
  useState: (value: unknown) => [value, () => {}],
}));
vi.mock("@livekit/components-react", () => ({
  useRoomContext: () => ({}),
  useLocalParticipant: () => ({ localParticipant: { streamBytes: state.streamBytes } }),
}));
vi.mock("@/lib/telemetry.client", () => ({ logBrowserWarning: vi.fn() }));
const { useChatImages } = await import("@/features/room/hooks/use-chat-images");
const image = new File([Uint8Array.of(1)], "print.png", { type: "image/png" });
/** The byte stream LiveKit hands back: the image and its text go out through it. */
const writer = (id: string) => ({
  info: { id },
  write: vi.fn(async () => {}),
  close: vi.fn(async () => {}),
});
beforeEach(() => vi.resetAllMocks());

test("clipboard pastes cannot start concurrent transfers", async () => {
  const { promise, resolve } = Promise.withResolvers<ReturnType<typeof writer>>();
  state.streamBytes.mockReturnValue(promise);
  const chat = useChatImages();
  const first = chat.sendImage(image);
  expect(await chat.sendImage(image)).toBe("Wait for the current image to finish sending.");
  expect(state.streamBytes).toHaveBeenCalledOnce();
  resolve(writer("first"));
  expect(await first).toBeUndefined();
});

test("the eleventh transfer is refused before publishing", async () => {
  state.streamBytes.mockResolvedValue(writer("image"));
  const chat = useChatImages();
  for (let index = 0; index < 10; index += 1) expect(await chat.sendImage(image)).toBeUndefined();
  expect(await chat.sendImage(image)).toBeDefined();
  expect(state.streamBytes).toHaveBeenCalledTimes(10);
});

test("a failed transfer releases the concurrent-send guard", async () => {
  state.streamBytes
    .mockRejectedValueOnce(new Error("disconnected"))
    .mockResolvedValue(writer("retry"));
  const chat = useChatImages();
  await expect(chat.sendImage(image)).rejects.toThrow("disconnected");
  expect(await chat.sendImage(image)).toBeUndefined();
});
