import { CHAT_IMAGE_MAX_BYTES } from "@/features/room/domain/chat-images";

interface ImageReader extends AsyncIterable<Uint8Array> {
  info: { size?: number };
}

/**
 * Drain every stream, including refused ones: abandoning LiveKit's iterator only releases
 * its lock, so subsequent chunks would remain queued in the SDK. Retain at most 5 MB.
 */
export async function readChatImage(
  reader: ImageReader,
  admitted: boolean,
): Promise<Uint8Array<ArrayBuffer> | undefined> {
  let keep = admitted && (reader.info.size ?? 0) <= CHAT_IMAGE_MAX_BYTES;
  const chunks: Uint8Array[] = [];
  let total = 0;
  for await (const chunk of reader) {
    if (!keep) continue;
    total += chunk.byteLength;
    if (total > CHAT_IMAGE_MAX_BYTES) {
      keep = false;
      chunks.length = 0;
      continue;
    }
    chunks.push(chunk);
  }
  if (!keep) return undefined;
  const bytes = new Uint8Array(total);
  chunks.reduce((offset, chunk) => {
    bytes.set(chunk, offset);
    return offset + chunk.byteLength;
  }, 0);
  return bytes;
}
