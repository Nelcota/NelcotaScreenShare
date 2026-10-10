import {
  useChat,
  useDataChannel,
  useLocalParticipant,
  type ReceivedChatMessage,
} from "@livekit/components-react";
import type { Participant } from "livekit-client";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { playChatNotification } from "@/features/room/audio/chat-notification";
import { useShortcut } from "@/lib/hooks/use-shortcut";
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
}

export interface ChatState {
  messages: ChatEntry[];
  send: (text: string) => Promise<unknown>;
  /** Own messages only: others apply it by the sender's identity. */
  edit: (id: string, text: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  isSending: boolean;
  open: boolean;
  unread: number;
  setOpen: (open: boolean) => void;
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
  const [seen, setSeen] = useState(0);
  const announced = useRef(0);
  const [edits, setEdits] = useState<ChatEdits>(() => new Map());

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
    setSeen(chatMessages.length);
    setOpenState(next);
  }

  const messages = chatMessages.map((message: ReceivedChatMessage): ChatEntry => {
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

  // Panel closed: notify about a new message from someone else.
  useEffect(() => {
    const fresh = chatMessages.slice(announced.current);
    announced.current = chatMessages.length;
    if (open) return;
    const last = fresh.findLast((message) => !message.from?.isLocal);
    if (last) {
      void playChatNotification();
      toast(`${participantLabel(last.from)}: ${capChatText(last.message)}`, {
        id: chatToastId(last.id),
        action: { label: "Abrir", onClick: () => setOpenState(true) },
      });
    }
  }, [open, chatMessages]);

  useShortcut("c", () => setOpen(!open));

  const unread = open
    ? 0
    : messages.slice(seen).filter((message) => !message.mine && !message.deleted).length;

  return {
    messages,
    send,
    edit: (id, text) => change({ type: "edit", id, text }),
    remove: (id) => change({ type: "delete", id }),
    isSending,
    open,
    unread,
    setOpen,
  };
}
