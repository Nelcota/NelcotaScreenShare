import { useLocalParticipant, useRoomContext } from "@livekit/components-react";
import type { ByteStreamReader, Participant } from "livekit-client";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { readChatImage } from "@/features/room/client/read-chat-image";
import {
  CHAT_FILE_TOPIC,
  CHAT_TEXT_MAX_BYTES,
  cleanTextFileName,
  plainText,
} from "@/features/room/domain/chat-files";
import {
  admitImage,
  CHAT_IMAGE_CAPTION_ATTRIBUTE,
  receivedCaption,
  sendingPaceProblem,
} from "@/features/room/domain/chat-images";
import { capChatText } from "@/features/room/domain/data-channel";
import { logBrowserWarning } from "@/lib/telemetry.client";

/** A text file in the call chat, kept only in this browser's memory while the call lasts. */
export interface ChatFile {
  id: string;
  from: Participant | undefined;
  mine: boolean;
  timestamp: number;
  /** Cleaned: no folders, no second extension, always ".txt". */
  name: string;
  text: string;
  /** The text sent with it, shown above the card; empty when it came alone. */
  caption: string;
}

/**
 * Text files sent in the call chat: straight to the people connected, like the
 * images, never to the server, with the same limit of ten a minute per person. Whoever
 * receives one keeps it only when it is plain text within 1 MB.
 */
export function useChatFiles() {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const [files, setFiles] = useState<readonly ChatFile[]>([]);
  const [sending, setSending] = useState(false);
  const sent = useRef<readonly number[]>([]);
  const sendInFlight = useRef(false);

  function remember(file: ChatFile) {
    setFiles((current) => [...current, file]);
  }
  const keepReceived = useEffectEvent(remember);

  useEffect(() => {
    const arrivals = new Map<string, readonly number[]>();
    const admit = (identity: string) => {
      const admitted = admitImage(arrivals.get(identity) ?? [], Date.now());
      if (admitted) arrivals.set(identity, admitted);
      return admitted !== undefined;
    };
    const receive = async (reader: ByteStreamReader, identity: string) => {
      try {
        const bytes = await readChatImage(reader, admit(identity), CHAT_TEXT_MAX_BYTES);
        const text = bytes ? plainText(bytes) : undefined;
        if (text === undefined) return;
        keepReceived({
          id: reader.info.id,
          from: room.remoteParticipants.get(identity),
          mine: false,
          timestamp: reader.info.timestamp,
          name: cleanTextFileName(reader.info.name),
          text,
          caption: receivedCaption(reader.info.attributes),
        });
      } catch (error) {
        logBrowserWarning("Could not receive a chat file", error);
      }
    };
    room.registerByteStreamHandler(CHAT_FILE_TOPIC, (reader, { identity }) => {
      void receive(reader, identity);
    });
    return () => room.unregisterByteStreamHandler(CHAT_FILE_TOPIC);
  }, [room]);

  /**
   * Sends a text file already checked by the form (name, size and plain text), with the text
   * typed next to it, as one message. Returns why it did not go out, when it did not.
   */
  async function sendFile(file: File, text: string, typed = ""): Promise<string | undefined> {
    if (sendInFlight.current) return "Wait for the current file to finish sending.";
    const now = Date.now();
    const paceProblem = sendingPaceProblem(sent.current, now);
    if (paceProblem) return paceProblem;
    sent.current = admitImage(sent.current, now) ?? sent.current;
    sendInFlight.current = true;
    setSending(true);
    try {
      const caption = capChatText(typed.trim());
      const name = cleanTextFileName(file.name);
      const writer = await localParticipant.streamBytes({
        topic: CHAT_FILE_TOPIC,
        mimeType: "text/plain",
        name,
        totalSize: file.size,
        attributes: caption ? { [CHAT_IMAGE_CAPTION_ATTRIBUTE]: caption } : undefined,
      });
      await writer.write(new Uint8Array(await file.arrayBuffer()));
      await writer.close();
      remember({
        id: writer.info.id,
        from: localParticipant,
        mine: true,
        timestamp: Date.now(),
        name,
        text,
        caption,
      });
      return undefined;
    } finally {
      sendInFlight.current = false;
      setSending(false);
    }
  }

  return { files, sendFile, sending };
}
