import { useLocalParticipant, useRoomContext } from "@livekit/components-react";
import type { ByteStreamReader, Participant, Room } from "livekit-client";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  admitImage,
  CHAT_IMAGE_MAX_BYTES,
  CHAT_IMAGE_TOPIC,
  receivedImageType,
} from "@/features/room/domain/chat-images";
import { logBrowserWarning } from "@/lib/telemetry.client";

/** An image in the call chat, kept only in this browser's memory while the call lasts. */
export interface ChatImage {
  id: string;
  from: Participant | undefined;
  mine: boolean;
  timestamp: number;
  url: string;
  name: string;
}

/**
 * The bytes of one received image, read in pieces and dropped as soon as they pass the
 * limit: the declared size comes from another browser too.
 */
async function readWithinLimit(
  reader: ByteStreamReader,
): Promise<Uint8Array<ArrayBuffer> | undefined> {
  if ((reader.info.size ?? 0) > CHAT_IMAGE_MAX_BYTES) return undefined;
  const chunks: Uint8Array[] = [];
  let total = 0;
  for await (const chunk of reader) {
    total += chunk.byteLength;
    if (total > CHAT_IMAGE_MAX_BYTES) return undefined;
    chunks.push(chunk);
  }
  const bytes = new Uint8Array(total);
  chunks.reduce((offset, chunk) => {
    bytes.set(chunk, offset);
    return offset + chunk.byteLength;
  }, 0);
  return bytes;
}

function senderOf(room: Room, identity: string): Participant | undefined {
  return room.remoteParticipants.get(identity);
}

/**
 * Images sent in the call chat: straight to the people connected (LiveKit's file streams),
 * never to the server. Whoever joins later does not see earlier ones, as with the text.
 */
export function useChatImages() {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const [images, setImages] = useState<readonly ChatImage[]>([]);
  const [sending, setSending] = useState(false);
  // Object URLs to free when the call ends.
  const urls = useRef<string[]>([]);

  function remember(image: ChatImage) {
    urls.current.push(image.url);
    setImages((current) => [...current, image]);
  }
  const keepReceived = useEffectEvent(remember);

  useEffect(() => {
    // When each person's images arrived in the last minute.
    const arrivals = new Map<string, readonly number[]>();
    const admit = (identity: string) => {
      const admitted = admitImage(arrivals.get(identity) ?? [], Date.now());
      if (admitted) arrivals.set(identity, admitted);
      return admitted !== undefined;
    };
    const receive = async (reader: ByteStreamReader, { identity }: { identity: string }) => {
      if (!admit(identity)) return;
      try {
        const bytes = await readWithinLimit(reader);
        const type = bytes ? receivedImageType(bytes) : undefined;
        if (!bytes || !type) return;
        keepReceived({
          id: reader.info.id,
          from: senderOf(room, identity),
          mine: false,
          timestamp: reader.info.timestamp,
          url: URL.createObjectURL(new Blob([bytes], { type })),
          name: reader.info.name,
        });
      } catch (error) {
        logBrowserWarning("Could not receive a chat image", error);
      }
    };
    room.registerByteStreamHandler(CHAT_IMAGE_TOPIC, (reader, sender) => {
      void receive(reader, sender);
    });
    return () => room.unregisterByteStreamHandler(CHAT_IMAGE_TOPIC);
  }, [room]);

  useEffect(() => {
    const kept = urls.current;
    return () => {
      for (const url of kept) URL.revokeObjectURL(url);
    };
  }, []);

  /** Sends an image already checked by the form (type and size). */
  async function sendImage(file: File) {
    setSending(true);
    try {
      const { id } = await localParticipant.sendFile(file, {
        topic: CHAT_IMAGE_TOPIC,
        mimeType: file.type,
      });
      remember({
        id,
        from: localParticipant,
        mine: true,
        timestamp: Date.now(),
        url: URL.createObjectURL(file),
        name: file.name,
      });
    } finally {
      setSending(false);
    }
  }

  return { images, sendImage, sending };
}
