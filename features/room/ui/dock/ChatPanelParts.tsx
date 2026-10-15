import { ArrowDown, EyeOff, MessagesSquare, X } from "lucide-react";
import type { RefObject } from "react";
import { chatGroupStarts } from "@/features/room/domain/chat-format";
import type { ChatEntry } from "@/features/room/hooks/use-chat-state";
import { ChatMessage } from "./ChatMessage";
import { copyText } from "@/lib/clipboard";

async function copyMessage(text: string) {
  await copyText(text, {
    context: "Could not copy the message",
    success: "Mensagem copiada",
    failure: "Não foi possível copiar a mensagem.",
  });
}

export function ChatHeader({ onClose }: { onClose: () => void }) {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-line py-3 pr-2 pl-4">
      <div className="min-w-0">
        <h2 className="text-base font-semibold tracking-[-0.025em]">Chat da sala</h2>
        <p className="flex items-center gap-1.5 text-xs text-ink-subtle">
          <EyeOff className="size-3.5 shrink-0" aria-hidden="true" />
          Some quando a sala acaba
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar chat"
        className="grid size-10 shrink-0 place-items-center rounded-full text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink focus-visible:bg-surface-3 focus-visible:outline-none active:scale-95"
      >
        <X className="size-5" aria-hidden="true" />
      </button>
    </header>
  );
}

export function ChatEmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-brand/12 text-brand-soft">
        <MessagesSquare className="size-6" aria-hidden="true" />
      </span>
      <div>
        <p className="text-base font-medium">Nenhuma mensagem ainda</p>
        <p className="mt-1 text-sm text-ink-muted">As mensagens aparecem aqui.</p>
      </div>
    </div>
  );
}

interface ChatMessageListProps {
  listRef: RefObject<HTMLOListElement | null>;
  messages: ChatEntry[];
  editingId: string | undefined;
  missed: number;
  onScroll: (list: HTMLOListElement) => void;
  onJumpToEnd: () => void;
  onEdit: (message: ChatEntry) => void;
  onDelete: (id: string) => void;
}

export function ChatMessageList({
  listRef,
  messages,
  editingId,
  missed,
  onScroll,
  onJumpToEnd,
  onEdit,
  onDelete,
}: ChatMessageListProps) {
  const starts = chatGroupStarts(
    messages.map((message) => ({
      author: message.from?.identity,
      timestamp: message.timestamp,
    })),
  );

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <ol
        ref={listRef}
        aria-live="polite"
        onScroll={(event) => onScroll(event.currentTarget)}
        className="flex flex-1 flex-col overflow-y-auto px-3 py-4"
      >
        {messages.map((message, index) => (
          <ChatMessage
            key={message.id}
            message={message}
            groupStart={starts[index] ?? true}
            editing={message.id === editingId}
            onEdit={() => onEdit(message)}
            onDelete={() => onDelete(message.id)}
            onCopy={() => void copyMessage(message.text)}
          />
        ))}
      </ol>
      {missed > 0 ? (
        <button
          type="button"
          onClick={onJumpToEnd}
          className="absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-brand px-3.5 py-1.5 text-sm font-medium text-brand-ink shadow-soft transition-colors hover:bg-brand-hover"
        >
          <ArrowDown className="size-4" aria-hidden="true" />
          {missed === 1 ? "1 nova mensagem" : `${missed} novas mensagens`}
        </button>
      ) : null}
    </div>
  );
}
