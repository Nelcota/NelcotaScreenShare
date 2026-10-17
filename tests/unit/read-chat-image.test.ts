import { expect, test } from "vitest";
import { readChatImage } from "@/features/room/client/read-chat-image";
import { CHAT_IMAGE_MAX_BYTES } from "@/features/room/domain/chat-images";

function incoming(size: number | undefined, chunks: Uint8Array[]) {
  let consumed = 0;
  return {
    get consumed() {
      return consumed;
    },
    info: { size },
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) {
        consumed += 1;
        yield chunk;
      }
    },
  };
}

test("a refused sender is drained without keeping image bytes", async () => {
  const reader = incoming(3, [Uint8Array.of(1), Uint8Array.of(2), Uint8Array.of(3)]);
  expect(await readChatImage(reader, false)).toBeUndefined();
  expect(reader.consumed).toBe(3);
});

test("an oversized declared size still drains the whole stream", async () => {
  const reader = incoming(CHAT_IMAGE_MAX_BYTES + 1, [Uint8Array.of(1), Uint8Array.of(2)]);
  expect(await readChatImage(reader, true)).toBeUndefined();
  expect(reader.consumed).toBe(2);
});

test("an unknown size exceeding the limit drops retained bytes and drains the rest", async () => {
  const reader = incoming(undefined, [
    new Uint8Array(CHAT_IMAGE_MAX_BYTES),
    Uint8Array.of(1),
    Uint8Array.of(2),
  ]);
  expect(await readChatImage(reader, true)).toBeUndefined();
  expect(reader.consumed).toBe(3);
});

test("an admitted image within the limit preserves its bytes", async () => {
  expect(await readChatImage(incoming(3, [Uint8Array.of(1, 2), Uint8Array.of(3)]), true)).toEqual(
    Uint8Array.of(1, 2, 3),
  );
});
