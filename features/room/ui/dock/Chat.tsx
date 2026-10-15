import { useRef } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";
import type { ChatState } from "@/features/room/hooks/use-chat-state";
import { ChatComposer } from "./ChatComposer";
import { ChatSoundSettings } from "./ChatSoundSettings";
import { ChatEmptyState, ChatHeader, ChatMessageList } from "./ChatPanelParts";
import { useChatEditing, useChatPanelMotion, useChatScroll } from "./use-chat-panel";

export function ChatPanel({ chat }: { chat: ChatState }) {
  const reducedMotion = useReducedMotion();
  const scope = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const editor = useChatEditing(chat, inputRef);
  useChatPanelMotion(scope, chat.open, reducedMotion);
  const { missed, scrollToEnd, handleScroll } = useChatScroll(chat, listRef, inputRef);

  return (
    <aside
      ref={scope}
      aria-hidden={!chat.open}
      inert={!chat.open}
      aria-label="Chat da sala"
      data-chat-open={chat.open || undefined}
      // Wide screen: a column as tall as the room, aligned with the top of the bar and the bottom of the dock.
      className="glass invisible fixed top-20 right-3 bottom-32 z-40 flex w-[min(24rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-3xl group-data-capture-bar/room:max-lg:bottom-42 sm:right-6 lg:top-4 lg:bottom-4"
    >
      <ChatHeader onClose={() => chat.setOpen(false)} />
      <ChatSoundSettings />

      {chat.messages.length === 0 ? (
        <ChatEmptyState />
      ) : (
        <ChatMessageList
          listRef={listRef}
          messages={chat.messages}
          editingId={editor.editingId}
          missed={missed}
          onScroll={handleScroll}
          onJumpToEnd={() => scrollToEnd(reducedMotion ? "auto" : "smooth")}
          onEdit={editor.startEditing}
          onDelete={editor.setDeletingId}
        />
      )}

      <ChatComposer
        inputRef={inputRef}
        draft={editor.draft}
        onDraftChange={editor.setDraft}
        editing={editor.editing !== undefined}
        busy={editor.busy || chat.isSending}
        onSubmit={() => void editor.submit()}
        onCancelEdit={editor.cancelEditing}
        onEditLast={editor.editLast}
        onClose={() => chat.setOpen(false)}
      />

      <ConfirmDialog
        open={editor.deletingId !== undefined}
        onOpenChange={(next) => {
          if (!next) editor.setDeletingId(undefined);
        }}
        title="Apagar mensagem?"
        description="Ela some da sala. Quem já leu pode ter visto."
        confirmLabel="Apagar"
        danger
        pending={editor.busy}
        onConfirm={() => void editor.confirmDelete()}
      />
    </aside>
  );
}
