import { useLocalParticipant, useRoomContext } from "@livekit/components-react";
import type { ByteStreamReader, Participant, Room } from "livekit-client";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  admitImage,
  CHAT_IMAGE_TOPIC,
  receivedImageType,
  sendingPaceProblem,
} from "@/features/room/domain/chat-images";
import { readChatImage } from "@/features/room/client/read-chat-image";
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
  // When this browser's images went out in the last minute, under the limit the others apply.
  const sent = useRef<readonly number[]>([]);
  const sendInFlight = useRef(false);

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
      const admitted = admit(identity);
      try {
        const bytes = await readChatImage(reader, admitted);
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

  /**
   * Sends an image already checked by the form (type and size). Returns why it did not go
   * out when this person already sent as many as the others accept in a minute.
   */
  async function sendImage(file: File): Promise<string | undefined> {
    if (sendInFlight.current) return "Wait for the current image to finish sending.";
    const now = Date.now();
    const paceProblem = sendingPaceProblem(sent.current, now);
    if (paceProblem) return paceProblem;
    // Reserve before awaiting: clipboard pastes can arrive while a transfer is in flight.
    sent.current = admitImage(sent.current, now) ?? sent.current;
    sendInFlight.current = true;
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
      return undefined;
    } finally {
      sendInFlight.current = false;
      setSending(false);
    }
  }

  return { images, sendImage, sending };
}
