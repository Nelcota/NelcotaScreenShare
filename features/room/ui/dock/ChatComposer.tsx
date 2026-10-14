import { ArrowUp, Check, Pencil, X } from "lucide-react";
import { useId, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { CHAT_MAX_LENGTH } from "@/features/room/domain/data-channel";
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
}) {
  const inputId = useId();
  const remaining = CHAT_MAX_LENGTH - draft.length;
  const canSend = draft.trim().length > 0 && !busy;

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
          <button
            type="button"
            onClick={onCancelEdit}
            aria-label="Cancelar edição"
            className="ml-auto grid size-7 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}
      <div className="flex items-end gap-2 rounded-3xl border border-line bg-surface-2 p-1.5 pl-4 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
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
          loading={busy}
          disabled={!canSend}
          aria-label={editing ? "Salvar edição" : "Enviar mensagem"}
          className="size-9 shrink-0 rounded-full transition-transform active:scale-90"
        >
          {busy ? null : editing ? (
            <Check className="size-5" aria-hidden="true" />
          ) : (
            <ArrowUp className="size-5" aria-hidden="true" />
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
