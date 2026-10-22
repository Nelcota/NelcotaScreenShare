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
const { useChatFiles } = await import("@/features/room/hooks/use-chat-files");
const notes = new File(["oi"], "notas.txt", { type: "text/plain" });
const writer = (id: string) => ({
  info: { id },
  write: vi.fn(async () => {}),
  close: vi.fn(async () => {}),
});
beforeEach(() => vi.resetAllMocks());

test("a second file while one is sending is refused in Portuguese, the person reads it", async () => {
  const { promise, resolve } = Promise.withResolvers<ReturnType<typeof writer>>();
  state.streamBytes.mockReturnValue(promise);
  const chat = useChatFiles();
  const first = chat.sendFile(notes, "oi");
  expect(await chat.sendFile(notes, "oi")).toBe("Espere o arquivo anterior terminar de enviar.");
  resolve(writer("first"));
  expect(await first).toBeUndefined();
});

test("the text checked when the file was picked is what goes out", async () => {
  const out = writer("sent");
  state.streamBytes.mockResolvedValue(out);
  const chat = useChatFiles();
  // The file changed on disk after it was picked: what was checked still goes.
  const changed = new File(["outra coisa, bem maior"], "notas.txt", { type: "text/plain" });
  expect(await chat.sendFile(changed, "ação")).toBeUndefined();
  const sent = new TextEncoder().encode("ação");
  expect(state.streamBytes).toHaveBeenCalledWith(
    expect.objectContaining({ totalSize: sent.byteLength }),
  );
  expect(out.write).toHaveBeenCalledWith(sent);
});
