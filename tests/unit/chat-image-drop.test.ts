import { expect, test, vi } from "vitest";
import type * as React from "react";

vi.mock("react", async (original) => ({
  ...(await original<typeof React>()),
  useState: (value: unknown) => [value, () => {}],
}));
vi.mock("@/features/room/client/call-notices", () => ({ callToast: { error: vi.fn() } }));
const { useImageDrop } = await import("@/features/room/ui/dock/use-chat-attachment");

function fileDrag() {
  const file = new File([Uint8Array.of(1)], "print.png", { type: "image/png" });
  return {
    dataTransfer: { types: ["Files"], files: [file] },
    preventDefault: vi.fn(),
  } as unknown as React.DragEvent<HTMLElement> & { preventDefault: ReturnType<typeof vi.fn> };
}

test("a file dropped on the chat never reaches the browser, even while a message is edited", () => {
  const onImage = vi.fn();
  // Editing: no attachment, but the browser must not open the file and leave the call.
  const { handlers } = useImageDrop(onImage, false);
  const over = fileDrag();
  const drop = fileDrag();
  handlers.onDragOver(over);
  handlers.onDrop(drop);
  expect(over.preventDefault).toHaveBeenCalled();
  expect(drop.preventDefault).toHaveBeenCalled();
  expect(onImage).not.toHaveBeenCalled();
});

test("a file dropped while not editing waits in the box", () => {
  const onImage = vi.fn();
  const { handlers } = useImageDrop(onImage, true);
  handlers.onDrop(fileDrag());
  expect(onImage).toHaveBeenCalledOnce();
});
