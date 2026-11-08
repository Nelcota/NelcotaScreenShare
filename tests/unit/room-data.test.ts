import { afterEach, describe, expect, it, vi } from "vitest";
import { savedMicrophone, saveMicrophone } from "@/features/room/client/saved-microphone";
import { contentBox } from "@/features/room/domain/content-box";
import {
  CHAT_MAX_LENGTH,
  capChatText,
  createReceiveThrottle,
  decodeMessage,
  encodeMessage,
  pointerSchema,
  reactionSchema,
  receivedTimestamp,
} from "@/features/room/domain/data-channel";

describe("data channel messages", () => {
  it("caps received chat text at the composer limit", () => {
    expect(capChatText("oi")).toBe("oi");
    expect(capChatText("a".repeat(CHAT_MAX_LENGTH + 50))).toHaveLength(CHAT_MAX_LENGTH);
  });

  it("round-trips a valid reaction", () => {
    expect(decodeMessage(encodeMessage({ emoji: "🎉" }), reactionSchema)).toEqual({ emoji: "🎉" });
  });

  it("drops invalid JSON, emoji outside the list and point outside the image", () => {
    expect(decodeMessage(new TextEncoder().encode("{oops"), reactionSchema)).toBeUndefined();
    expect(decodeMessage(encodeMessage({ emoji: "💣" }), reactionSchema)).toBeUndefined();
    expect(
      decodeMessage(encodeMessage({ trackSid: "TR_1", x: 1.2, y: 0.5 }), pointerSchema),
    ).toBeUndefined();
    expect(
      decodeMessage(encodeMessage({ trackSid: "", x: 0.2, y: 0.5 }), pointerSchema),
    ).toBeUndefined();
  });

  it("keeps a usable stream timestamp and replaces one a Date cannot show", () => {
    const arrivedAt = 1_700_000_000_000;

    expect(receivedTimestamp(1_600_000_000_000, arrivedAt)).toBe(1_600_000_000_000);
    expect(receivedTimestamp(9e15, arrivedAt)).toBe(arrivedAt);
    expect(receivedTimestamp(Number.NaN, arrivedAt)).toBe(arrivedAt);
    expect(receivedTimestamp(undefined, arrivedAt)).toBe(arrivedAt);
  });
});

describe("receiver-side rate limit", () => {
  it("accepts one message per sender per interval", () => {
    let now = 0;
    const accept = createReceiveThrottle(100, () => now);
    expect(accept("ana")).toBe(true);
    now = 50;
    expect(accept("ana")).toBe(false);
    expect(accept("bia")).toBe(true);
    now = 100;
    expect(accept("ana")).toBe(true);
  });
});

describe("image area within the video", () => {
  it("side bars when the video is narrower", () => {
    expect(contentBox({ width: 200, height: 100 }, { width: 100, height: 100 })).toEqual({
      left: 50,
      top: 0,
      width: 100,
      height: 100,
    });
  });

  it("top and bottom bars when the video is wider", () => {
    expect(contentBox({ width: 100, height: 100 }, { width: 200, height: 100 })).toEqual({
      left: 0,
      top: 25,
      width: 100,
      height: 50,
    });
  });

  it("video without a size yet fills the whole box", () => {
    expect(contentBox({ width: 80, height: 60 }, { width: 0, height: 0 })).toEqual({
      left: 0,
      top: 0,
      width: 80,
      height: 60,
    });
  });
});

describe("saved microphone", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("remembers and forgets the choice", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
    });
    saveMicrophone("mic-1");
    expect(savedMicrophone()).toBe("mic-1");
    saveMicrophone(undefined);
    expect(savedMicrophone()).toBeUndefined();
  });

  it("ignores a stored value that is not a device id", () => {
    vi.stubGlobal("localStorage", { getItem: () => "x".repeat(1000) });
    expect(savedMicrophone()).toBeUndefined();
  });

  it("blocked storage does not break", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    });
    expect(() => saveMicrophone("mic-1")).not.toThrow();
    expect(savedMicrophone()).toBeUndefined();
  });
});
