import { useRef } from "react";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";
import type { ChatState } from "@/features/room/hooks/use-chat-state";
import { callToast as toast } from "@/features/room/client/call-notices";
import { reportBrowserError } from "@/lib/telemetry.client";
import { ChatComposer } from "./ChatComposer";
import { ChatSoundSettings } from "./ChatSoundSettings";
import { ChatEmptyState, ChatHeader, ChatMessageList } from "./ChatPanelParts";
import { useChatAttachment, useImageDrop } from "./use-chat-attachment";
import { useChatEditing, useChatPanelMotion, useChatScroll } from "./use-chat-panel";

/** Sends the image waiting in the box with the text; `false`, and why, when it cannot go. */
async function sendChatImage(chat: ChatState, file: File, text: string): Promise<boolean> {
  try {
    const refused = await chat.sendImage(file, text);
    if (!refused) return true;
    toast.error(refused);
    return false;
  } catch (error) {
    reportBrowserError(error);
    toast.error("Não foi possível enviar a imagem. Tente de novo.");
    return false;
  }
}

export function ChatPanel({ chat }: { chat: ChatState }) {
  const reducedMotion = useReducedMotion();
  const scope = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const editor = useChatEditing(chat, inputRef);
  useChatPanelMotion(scope, chat.open, reducedMotion);
  const { missed, scrollToEnd, handleScroll } = useChatScroll(chat, listRef, inputRef);
  const attachment = useChatAttachment();
  const editing = editor.editing !== undefined;
  const drop = useImageDrop(attachment.attach, !editing);

  /** Enter: the image waiting in the box goes with the text, as one message. */
  async function submit() {
    const attached = attachment.attached;
    if (!attached || editing) {
      await editor.submit();
      return;
    }
    if (!(await sendChatImage(chat, attached.file, editor.draft))) return;
    attachment.clear();
    editor.setDraft("");
    inputRef.current?.focus();
  }

  return (
    <aside
      ref={scope}
      aria-hidden={!chat.open}
      inert={!chat.open}
      aria-label="Chat da sala"
      data-chat-open={chat.open || undefined}
      {...drop.handlers}
      // Wide screen: a column as tall as the room, aligned with the top of the bar and the bottom of the dock.
      className={cn(
        "glass invisible fixed top-20 right-3 bottom-32 z-40 flex w-[min(24rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-3xl group-data-capture-bar/room:max-lg:bottom-42 sm:right-6 lg:top-4 lg:bottom-4",
        drop.dropping && "ring-2 ring-brand-soft",
      )}
    >
      {drop.dropping ? (
        <p className="pointer-events-none absolute inset-x-3 top-24 z-10 rounded-2xl bg-surface/95 px-4 py-3 text-center text-sm font-medium text-ink shadow-soft">
          Solte para anexar a imagem
        </p>
      ) : null}
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
        editing={editing}
        busy={editor.busy || chat.isSending}
        onSubmit={() => void submit()}
        onCancelEdit={editor.cancelEditing}
        onEditLast={editor.editLast}
        onClose={() => chat.setOpen(false)}
        sendingImage={chat.sendingImage}
        onImage={attachment.attach}
        attachment={attachment.attached}
        onRemoveAttachment={attachment.clear}
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
