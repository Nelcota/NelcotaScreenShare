import { beforeEach, expect, test, vi } from "vitest";
import type * as React from "react";
import type * as PrepareChatImage from "@/features/room/client/prepare-chat-image";

// Each useState gives its setter here, in the order the hook asks: attached, then preparing.
const setters: ReturnType<typeof vi.fn>[] = [];
vi.mock("react", async (original) => ({
  ...(await original<typeof React>()),
  useState: (value: unknown) => {
    const set = vi.fn();
    setters.push(set);
    return [value, set];
  },
  useRef: (value: unknown) => ({ current: value }),
  useEffect: () => {},
}));
vi.mock("@/features/room/client/call-notices", () => ({ callToast: { error: vi.fn() } }));
vi.mock("@/lib/telemetry.client", () => ({ reportBrowserError: vi.fn() }));
vi.mock("@/features/room/client/prepare-chat-image", async (original) => ({
  ...(await original<typeof PrepareChatImage>()),
  prepareChatImage: vi.fn(),
}));
const { prepareChatImage } = await import("@/features/room/client/prepare-chat-image");
const { useChatAttachment } = await import("@/features/room/ui/dock/use-chat-attachment");

function png(name: string): File {
  return new File([Uint8Array.of(1)], name, { type: "image/png" });
}

beforeEach(() => {
  setters.length = 0;
});

/** The hook called once, as a render would, with its state setters to watch. */
function useWatchedAttachment() {
  const hook = useChatAttachment();
  const [setAttached, setPreparing] = setters;
  if (!setAttached || !setPreparing) throw new Error("useChatAttachment changed its state");
  return { attach: hook.attach, setAttached, setPreparing };
}

async function settled() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

test("an earlier picture reduced after a newer one never replaces it in the box", async () => {
  const big = Promise.withResolvers<File>();
  const small = Promise.withResolvers<File>();
  vi.mocked(prepareChatImage).mockReturnValueOnce(big.promise).mockReturnValueOnce(small.promise);
  const { attach, setAttached, setPreparing } = useWatchedAttachment();

  attach(png("big.png"));
  attach(png("small.png"));
  const smallFile = png("small.png");
  small.resolve(smallFile);
  await settled();
  expect(setAttached).toHaveBeenCalledOnce();
  expect(setAttached).toHaveBeenLastCalledWith(expect.objectContaining({ file: smallFile }));
  expect(setPreparing).toHaveBeenLastCalledWith(false);

  big.resolve(png("big.webp"));
  await settled();
  expect(setAttached).toHaveBeenCalledOnce();
});

test("Enter keeps waiting while the newest picture is still being reduced", async () => {
  const big = Promise.withResolvers<File>();
  const slow = Promise.withResolvers<File>();
  vi.mocked(prepareChatImage).mockReturnValueOnce(big.promise).mockReturnValueOnce(slow.promise);
  const { attach, setAttached, setPreparing } = useWatchedAttachment();

  attach(png("big.png"));
  attach(png("slow.png"));
  big.resolve(png("big.webp"));
  await settled();
  expect(setAttached).not.toHaveBeenCalled();
  expect(setPreparing).not.toHaveBeenCalledWith(false);

  const slowFile = png("slow.webp");
  slow.resolve(slowFile);
  await settled();
  expect(setAttached).toHaveBeenLastCalledWith(expect.objectContaining({ file: slowFile }));
  expect(setPreparing).toHaveBeenLastCalledWith(false);
});
