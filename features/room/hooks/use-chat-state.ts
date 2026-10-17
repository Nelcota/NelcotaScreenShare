import {
  useChat,
  useDataChannel,
  useLocalParticipant,
  type ReceivedChatMessage,
} from "@livekit/components-react";
import type { Participant } from "livekit-client";
import { useEffect, useRef, useState } from "react";
import { callToast as toast } from "@/features/room/client/call-notices";
import { playChatNotification, unlockChatAudio } from "@/features/room/audio/chat-notification";
import { useRoomShortcut } from "@/lib/hooks/use-shortcut-keys";
import { useChatToasts } from "@/features/room/hooks/use-chat-toasts";
import { useChatImages, type ChatImage } from "@/features/room/hooks/use-chat-images";
import { participantLabel } from "@/features/room/domain/participant-label";
import {
  CHAT_EDIT_TOPIC,
  chatEditSchema,
  recordChatEdit,
  resolveChatText,
  type ChatEditOp,
  type ChatEdits,
} from "@/features/room/domain/chat-edits";
import { capChatText, decodeMessage, encodeMessage } from "@/features/room/domain/data-channel";

/** Message as it appears on screen: with edits and deletions already applied. */
export interface ChatEntry {
  id: string;
  from: Participant | undefined;
  mine: boolean;
  timestamp: number;
  text: string;
  edited: boolean;
  deleted: boolean;
  /** An image sent in the call (#412): shown instead of the text. */
  image?: { url: string; name: string };
}

export interface ChatState {
  messages: ChatEntry[];
  send: (text: string) => Promise<unknown>;
  /** Sends an image already checked (type and size) to everyone in the call. */
  sendImage: (file: File) => Promise<void>;
  sendingImage: boolean;
  /** Own messages only: others apply it by the sender's identity. */
  edit: (id: string, text: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  isSending: boolean;
  open: boolean;
  unread: number;
  setOpen: (open: boolean) => void;
}

/** An image as a chat entry: never edited or deleted, shown in place of the text. */
function imageEntry(image: ChatImage): ChatEntry {
  return {
    id: image.id,
    from: image.from,
    mine: image.mine,
    timestamp: image.timestamp,
    text: "",
    edited: false,
    deleted: false,
    image: { url: image.url, name: image.name },
  };
}

/** New message toast: disappears if the message is edited or deleted. */
function chatToastId(id: string): string {
  return `chat-${id}`;
}

/**
 * Chat state at the room level: messages arrive even with the panel
 * closed (unread counter and toast). Shortcut: C.
 */
export function useChatState(): ChatState {
  const { chatMessages, send, isSending } = useChat();
  const { localParticipant } = useLocalParticipant();
  const [open, setOpenState] = useState(false);
  // Messages already seen: when opening or closing the panel, everything up to then counts as read.
  // Texts and images each only grow at the end: how many of each were on screen.
  const [seen, setSeen] = useState({ texts: 0, images: 0 });
  const announced = useRef(0);
  const [edits, setEdits] = useState<ChatEdits>(() => new Map());
  const showChatToast = useChatToasts();
  const { images, sendImage, sending: sendingImage } = useChatImages();
  const announcedImages = useRef(0);

  const { send: publishEdit } = useDataChannel(CHAT_EDIT_TOPIC, (message) => {
    const sender = message.from?.identity;
    if (!sender) return;
    const edit = decodeMessage(message.payload, chatEditSchema);
    if (!edit) return;
    setEdits((current) => recordChatEdit(current, edit, sender));
    toast.dismiss(chatToastId(edit.id));
  });

  async function change(edit: ChatEditOp) {
    await publishEdit(encodeMessage(edit), { reliable: true });
    // The channel does not echo the notice back to the sender: apply it here too.
    setEdits((current) => recordChatEdit(current, edit, localParticipant.identity));
  }

  function setOpen(next: boolean) {
    setSeen({ texts: chatMessages.length, images: images.length });
    setOpenState(next);
  }

  const texts = chatMessages.map((message: ReceivedChatMessage): ChatEntry => {
    const resolved = resolveChatText(edits, {
      id: message.id,
      text: capChatText(message.message),
      author: message.from?.identity,
    });
    return {
      id: message.id,
      from: message.from,
      mine: message.from?.isLocal ?? false,
      timestamp: message.timestamp,
      ...resolved,
    };
  });

  const pictures = images.map(imageEntry);
  const messages = [...texts, ...pictures].toSorted(
    (first, second) => first.timestamp - second.timestamp,
  );

  // Browsers keep audio locked until the person interacts: the first click or key unlocks it.
  useEffect(() => {
    const unlock = () => void unlockChatAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  // Panel closed: notify about a new message from someone else.
  useEffect(() => {
    const fresh = chatMessages.slice(announced.current);
    announced.current = chatMessages.length;
    if (open) return;
    const last = fresh.findLast((message) => !message.from?.isLocal);
    if (last) {
      void playChatNotification();
      showChatToast({
        id: chatToastId(last.id),
        author: last.from,
        text: `${participantLabel(last.from)}: ${capChatText(last.message)}`,
      });
    }
  }, [open, chatMessages, showChatToast]);

  // The same for an image someone else sent.
  useEffect(() => {
    const fresh = images.slice(announcedImages.current);
    announcedImages.current = images.length;
    if (open) return;
    const last = fresh.findLast((image) => !image.mine);
    if (!last) return;
    void playChatNotification();
    showChatToast({
      id: chatToastId(last.id),
      author: last.from,
      text: `${participantLabel(last.from)} enviou uma imagem`,
    });
  }, [open, images, showChatToast]);

  useRoomShortcut("chat", () => setOpen(!open));

  const unreadEntries = [...texts.slice(seen.texts), ...pictures.slice(seen.images)];
  const unread = open
    ? 0
    : unreadEntries.filter((message) => !message.mine && !message.deleted).length;

  return {
    messages,
    send,
    sendImage,
    sendingImage,
    edit: (id, text) => change({ type: "edit", id, text }),
    remove: (id) => change({ type: "delete", id }),
    isSending,
    open,
    unread,
    setOpen,
  };
}
