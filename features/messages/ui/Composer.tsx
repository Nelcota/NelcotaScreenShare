import { SendHorizontal } from "lucide-react";
import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { sendMessage } from "@/features/messages/actions";
import { messageLengthNote } from "@/features/messages/domain/conversation";
import type { Gif } from "@/features/messages/domain/klipy";
import { useKlipy } from "@/features/messages/hooks/use-gif";
import { useAttachmentDraft } from "@/features/messages/hooks/use-attachment-draft";
import { sendWithAttachment } from "@/features/messages/client/send-with-attachment";
import { AttachButton, AttachmentTray } from "@/features/messages/ui/AttachmentTray";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { GifPicker } from "@/features/messages/ui/GifPicker";
import { cn } from "@/lib/utils";

type Outgoing = Parameters<typeof sendMessage>[0];

/** Sends right away, one after the other; true when the server took it. */
async function deliver(input: Outgoing): Promise<boolean> {
  const result = await sendMessage(input);
  if (result.data) return true;
  toast.error(result.serverError ?? "Não foi possível enviar agora.");
  return false;
}

/**
 * The message field: Enter sends, Shift+Enter breaks the line; GIF opens KLIPY's picker and
 * the clip picks a file, which waits above the box and goes with the text.
 */
export function Composer({
  conversationId,
  placeholder,
  favorites,
}: {
  conversationId: string;
  placeholder: string;
  favorites: readonly string[];
}) {
  const klipy = useKlipy();
  const [text, setText] = useState("");
  const [gifOpen, setGifOpen] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const picked = useRef(false);
  const attachment = useAttachmentDraft(conversationId);
  const body = text.trim();
  const note = messageLengthNote(body.length);
  const { ready } = attachment;
  const hasContent = body.length > 0 || ready !== null;
  const sendable = !attachment.uploading && hasContent && !note?.over;

  // The field clears at once, so the next message can be typed; the text comes back on failure.
  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (!sendable) return;
    setText("");
    if (ready !== null) {
      void sendWithAttachment({
        conversationId,
        body,
        attachment: ready,
        deliver,
        clear: attachment.clear,
        restore: (lostBody, file) => {
          setText((current) => current || lostBody);
          attachment.restore(file);
        },
      });
      return;
    }
    void deliver({ conversationId, body }).then((sent) => {
      if (!sent) setText((current) => current || body);
    });
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    submit();
  };
  const pickGif = (gif: Gif) => {
    picked.current = true;
    setGifOpen(false);
    void deliver({ conversationId, gifSlug: gif.slug });
    klipy?.share(gif.slug);
  };
  // After a pick the caret goes back to the message; Esc or a click outside returns to the trigger.
  const onCloseAutoFocus = (event: Event) => {
    if (!picked.current) return;
    picked.current = false;
    event.preventDefault();
    field.current?.focus();
  };

  return (
    <form
      onSubmit={submit}
      // The minimized call card never rests on the message box.
      data-call-card-clear=""
      className="relative px-4 pt-1 pb-4"
    >
      {attachment.draft ? (
        <AttachmentTray draft={attachment.draft} onClear={attachment.clear} />
      ) : null}
      <div className="flex items-end gap-1 rounded-2xl border border-line-strong bg-surface-2 p-1.5 focus-within:border-brand-soft">
        <AttachButton
          onPick={(file) => {
            void attachment.pick(file);
            field.current?.focus();
          }}
        />
        <label className="sr-only" htmlFor={`mensagem-${conversationId}`}>
          {placeholder}
        </label>
        <textarea
          id={`mensagem-${conversationId}`}
          ref={field}
          rows={1}
          value={text}
          aria-describedby={note ? `mensagem-tamanho-${conversationId}` : undefined}
          aria-invalid={note?.over ? true : undefined}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="field-sizing-content max-h-40 min-h-9 min-w-0 flex-1 resize-none self-center bg-transparent py-1.5 text-[0.9375rem] outline-none placeholder:text-ink-subtle"
        />
        {klipy ? (
          <Popover open={gifOpen} onOpenChange={setGifOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="GIFs"
                className={cn(
                  "grid h-9 shrink-0 place-items-center rounded-xl px-2.5 text-xs font-bold tracking-wide text-ink-muted hover:bg-ink/[0.07] hover:text-ink",
                  gifOpen && "bg-ink/[0.07] text-ink",
                )}
              >
                <span className="rounded-md border-2 border-current px-1 leading-4">GIF</span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="top"
              align="end"
              sideOffset={14}
              alignOffset={-6}
              collisionPadding={16}
              onCloseAutoFocus={onCloseAutoFocus}
              className="w-[calc(100vw-2rem)] gap-0 rounded-3xl bg-transparent p-0 shadow-none ring-0 sm:w-[25rem]"
            >
              <GifPicker favorites={favorites} onPick={pickGif} />
            </PopoverContent>
          </Popover>
        ) : null}
        <Button
          type="submit"
          size="icon"
          aria-label="Enviar"
          disabled={!sendable}
          className="size-9 shrink-0 rounded-full transition-transform active:scale-90"
        >
          <SendHorizontal className="size-5" aria-hidden="true" />
        </Button>
      </div>
      {note ? (
        <p
          id={`mensagem-tamanho-${conversationId}`}
          aria-live="polite"
          className={cn(
            "px-1 pt-1 text-right text-xs",
            note.over ? "text-danger" : "text-ink-muted",
          )}
        >
          {note.text}
        </p>
      ) : null}
    </form>
  );
}
