import { SendHorizontal } from "lucide-react";
import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { sendMessage } from "@/features/messages/actions";
import { MAX_MESSAGE_LENGTH } from "@/features/messages/domain/conversation";
import type { Gif } from "@/features/messages/domain/klipy";
import { useKlipy } from "@/features/messages/hooks/use-gif";
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

/** The message field: Enter sends, Shift+Enter breaks the line; GIF opens KLIPY's picker. */
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
  const body = text.trim();

  // The field clears at once, so the next message can be typed; the text comes back on failure.
  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (!body) return;
    setText("");
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
    setGifOpen(false);
    void deliver({ conversationId, gifSlug: gif.slug });
    klipy?.share(gif.slug);
    field.current?.focus();
  };

  return (
    <form onSubmit={submit} className="relative px-4 pt-1 pb-4">
      {gifOpen && klipy ? (
        <div className="absolute right-4 bottom-full z-20 mb-2 max-sm:left-4">
          <GifPicker favorites={favorites} onPick={pickGif} />
        </div>
      ) : null}
      <div className="flex items-end gap-1 rounded-2xl border border-line-strong bg-surface-2 p-1.5 pl-4 focus-within:border-brand-soft">
        <label className="sr-only" htmlFor={`mensagem-${conversationId}`}>
          {placeholder}
        </label>
        <textarea
          id={`mensagem-${conversationId}`}
          ref={field}
          rows={1}
          value={text}
          maxLength={MAX_MESSAGE_LENGTH}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="field-sizing-content max-h-40 min-h-9 min-w-0 flex-1 resize-none self-center bg-transparent py-1.5 text-[0.9375rem] outline-none placeholder:text-ink-subtle"
        />
        {klipy ? (
          <button
            type="button"
            aria-label="GIFs"
            aria-expanded={gifOpen}
            onClick={() => setGifOpen((open) => !open)}
            className={cn(
              "grid h-9 shrink-0 place-items-center rounded-xl px-2.5 text-xs font-bold tracking-wide text-ink-muted hover:bg-ink/[0.07] hover:text-ink",
              gifOpen && "bg-ink/[0.07] text-ink",
            )}
          >
            <span className="rounded-md border-2 border-current px-1 leading-4">GIF</span>
          </button>
        ) : null}
        <button
          type="submit"
          aria-label="Enviar"
          disabled={!body}
          className="disabled:bg-disabled disabled:text-disabled-ink grid size-9 shrink-0 place-items-center rounded-xl bg-brand text-brand-ink hover:bg-brand-hover"
        >
          <SendHorizontal className="size-4" aria-hidden="true" />
        </button>
      </div>
    </form>
  );
}
