import { Check, Pencil, SendHorizontal, X } from "lucide-react";
import { useId, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { CHAT_MAX_LENGTH } from "@/features/room/domain/data-channel";
import { ChatImageButton } from "./ChatImageButton";
import type { ChatAttachment } from "./use-chat-attachment";
import { cn } from "@/lib/utils";

/**
 * Chat input field. Enter sends, Shift+Enter inserts a line break, ↑ with an
 * empty field edits the last message and Esc cancels the edit (or closes the chat).
 */
export function ChatComposer({
  inputRef,
  draft,
  onDraftChange,
  editing,
  busy,
  onSubmit,
  onCancelEdit,
  onEditLast,
  onClose,
  sendingImage,
  onImage,
  attachment,
  onRemoveAttachment,
}: {
  inputRef: RefObject<HTMLTextAreaElement | null>;
  draft: string;
  onDraftChange: (text: string) => void;
  editing: boolean;
  busy: boolean;
  onSubmit: () => void;
  onCancelEdit: () => void;
  /** Returns `true` if there was a message to edit. */
  onEditLast: () => boolean;
  onClose: () => void;
  sendingImage: boolean;
  /** A picked, pasted or dropped image: it waits in the box until Enter. */
  onImage: (file: File) => void;
  attachment: ChatAttachment | undefined;
  onRemoveAttachment: () => void;
}) {
  const inputId = useId();
  const remaining = CHAT_MAX_LENGTH - draft.length;
  const waitingImage = attachment !== undefined && !editing;
  const canSend = (draft.trim().length > 0 || waitingImage) && !busy && !sendingImage;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className="border-t border-line p-3"
    >
      {editing ? (
        <div className="mb-2 flex items-center gap-2 rounded-xl bg-brand/10 py-1 pr-1 pl-3 text-xs">
          <Pencil className="size-3.5 shrink-0 text-brand-soft" aria-hidden="true" />
          <span className="font-medium text-brand-soft">Editando mensagem</span>
          <span className="text-ink-subtle max-sm:hidden">· Esc cancela</span>
          <Button
            type="button"
            variant="quiet"
            size="icon-sm"
            onClick={onCancelEdit}
            aria-label="Cancelar edição"
            className="ml-auto rounded-lg"
          >
            <X aria-hidden="true" />
          </Button>
        </div>
      ) : null}
      {waitingImage ? (
        <AttachmentPreview attachment={attachment} onRemove={onRemoveAttachment} />
      ) : null}
      <div className="flex items-end gap-1 rounded-3xl border border-line bg-surface-2 p-1.5 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
        {editing ? (
          <span className="w-2.5 shrink-0" />
        ) : (
          <ChatImageButton busy={sendingImage} onImage={onImage} />
        )}
        <label htmlFor={inputId} className="sr-only">
          {editing ? "Editar mensagem" : "Mensagem"}
        </label>
        <textarea
          ref={inputRef}
          id={inputId}
          rows={1}
          value={draft}
          autoComplete="off"
          maxLength={CHAT_MAX_LENGTH}
          placeholder="Escreva para a sala"
          onChange={(event) => onDraftChange(event.target.value)}
          onPaste={(event) => {
            // A pasted print goes as an image; pasted text stays text.
            const image = [...event.clipboardData.files].find((file) =>
              file.type.startsWith("image/"),
            );
            if (!image || editing) return;
            event.preventDefault();
            onImage(image);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              onSubmit();
              return;
            }
            if (event.key === "Escape") {
              if (editing) {
                onCancelEdit();
                return;
              }
              onClose();
              return;
            }
            if (event.key === "ArrowUp" && !draft && !editing && onEditLast()) {
              event.preventDefault();
            }
          }}
          className="field-sizing-content max-h-32 min-h-8 flex-1 resize-none self-center bg-transparent py-1 text-base text-ink outline-none placeholder:text-ink-subtle"
        />
        <Button
          type="submit"
          size="icon"
          loading={busy || sendingImage}
          disabled={!canSend}
          aria-label={editing ? "Salvar edição" : "Enviar mensagem"}
          className="size-9 shrink-0 rounded-full transition-transform active:scale-90"
        >
          {busy ? null : editing ? (
            <Check className="size-5" aria-hidden="true" />
          ) : (
            <SendHorizontal className="size-5" aria-hidden="true" />
          )}
        </Button>
      </div>
      <p className="mt-1.5 flex justify-between gap-2 px-2 text-xs text-ink-subtle">
        <span className="max-sm:hidden">Enter envia · Shift+Enter pula linha · ↑ edita</span>
        {remaining <= 50 ? (
          <span className={cn("ml-auto tabular-nums", remaining <= 10 && "text-warning")}>
            {remaining}
          </span>
        ) : null}
      </p>
    </form>
  );
}

/** The image waiting to go with the next Enter, with a way to take it out. */
function AttachmentPreview({
  attachment,
  onRemove,
}: {
  attachment: ChatAttachment;
  onRemove: () => void;
}) {
  return (
    <div className="mb-2 flex items-center gap-2 rounded-2xl bg-surface-2 p-1.5 pr-2">
      <img
        src={attachment.preview}
        alt={`Imagem anexada: ${attachment.file.name}`}
        className="size-14 shrink-0 rounded-xl object-cover"
      />
      <span className="min-w-0 flex-1 truncate text-xs text-ink-muted">{attachment.file.name}</span>
      <Button
        type="button"
        variant="quiet"
        size="icon-sm"
        onClick={onRemove}
        aria-label="Tirar a imagem"
        className="rounded-lg"
      >
        <X aria-hidden="true" />
      </Button>
    </div>
  );
}
