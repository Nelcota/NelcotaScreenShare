import { Phone, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { deleteMessage } from "@/features/messages/actions";
import type { Gif } from "@/features/messages/domain/klipy";
import {
  groupTimeline,
  messageTime,
  type MessageRun,
  type TimelineCall,
  type TimelineMessage,
} from "@/features/messages/domain/timeline";
import { useNow } from "@/lib/hooks/use-now";
import { AttachmentMessage } from "@/features/messages/ui/AttachmentMessage";
import { BubbleTime } from "@/features/messages/ui/BubbleTime";
import { useOperation } from "@/lib/operations/use-operation";
import { cn } from "@/lib/utils";

/** A GIF inside its bubble, keeping its proportions; a short note when it is gone. */
function GifView({ gif, at, own }: { gif: Gif | null; at: Date; own: boolean }) {
  if (!gif) {
    return (
      <p className="px-3 py-2 text-sm italic opacity-80">
        GIF indisponível
        <BubbleTime at={at} own={own} />
      </p>
    );
  }
  return (
    <span className="relative block">
      <img
        src={gif.full.url}
        alt={gif.title || "GIF"}
        width={gif.full.width}
        height={gif.full.height}
        loading="lazy"
        className="block h-auto w-56 rounded-[0.875rem] sm:w-64"
      />
      <BubbleTime at={at} own={own} overlay />
    </span>
  );
}

/** Only your own messages can be deleted, after confirming; they disappear for everyone. */
function DeleteButton({ messageId }: { messageId: string }) {
  const [confirming, setConfirming] = useState(false);
  const remove = useOperation(deleteMessage, {
    onSuccess: () => setConfirming(false),
    onError: () => toast.error("Não foi possível apagar agora."),
  });
  return (
    <>
      <button
        type="button"
        aria-label="Apagar mensagem"
        disabled={remove.isPending}
        onClick={() => setConfirming(true)}
        className="grid size-8 shrink-0 place-items-center self-center rounded-full text-danger opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-danger/10 pointer-coarse:opacity-100"
      >
        <Trash2 className="size-4" aria-hidden="true" />
      </button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Apagar mensagem?"
        description="Ela some para todos na conversa."
        confirmLabel="Apagar"
        danger
        pending={remove.isPending}
        onConfirm={() => remove.execute({ messageId })}
      />
    </>
  );
}

function MessageItem({
  message,
  first,
  own,
  showName,
}: {
  message: TimelineMessage;
  first: boolean;
  own: boolean;
  /** Groups name the other person above their first bubble. */
  showName: boolean;
}) {
  return (
    <li
      className={cn(
        "group flex items-end gap-1.5 px-3 sm:px-4",
        own ? "justify-end" : "justify-start",
        first ? "mt-4" : "mt-1.5",
      )}
    >
      {own ? <DeleteButton messageId={message.id} /> : null}
      {message.attachment ? (
        <AttachmentMessage
          message={message}
          attachment={message.attachment}
          own={own}
          showName={showName}
          first={first}
        />
      ) : (
        <TextBubble message={message} first={first} own={own} showName={showName} />
      )}
    </li>
  );
}

/** A text or a GIF in its bubble, with the author's name over the first one in groups. */
function TextBubble({
  message,
  first,
  own,
  showName,
}: {
  message: TimelineMessage;
  first: boolean;
  own: boolean;
  showName: boolean;
}) {
  const gif = message.gifSlug !== null;
  return (
    <div
      className={cn(
        "max-w-[min(80%,34rem)] rounded-2xl shadow-xs",
        own ? "bg-brand text-brand-ink" : "border border-line bg-surface-2 text-ink",
        first && (own ? "rounded-tr-md" : "rounded-tl-md"),
        gif ? "p-1" : "px-3 py-2",
      )}
    >
      {first && showName && !own ? (
        <p
          className={cn(
            "text-xs font-semibold text-brand-soft",
            gif ? "px-2 pt-1 pb-1.5" : "pb-0.5",
          )}
        >
          {message.authorName}
        </p>
      ) : null}
      {gif ? (
        <GifView gif={message.gif} at={message.createdAt} own={own} />
      ) : (
        <p className="text-[0.9375rem] leading-snug [overflow-wrap:anywhere] whitespace-pre-wrap">
          {message.body}
          <BubbleTime at={message.createdAt} own={own} />
        </p>
      )}
    </div>
  );
}

/** "Bruno começou uma chamada · 21:02", centered between the bubbles. */
function CallLine({ call }: { call: TimelineCall }) {
  return (
    <li className="mt-4 flex justify-center px-3">
      <span className="flex items-center gap-2 rounded-full bg-surface-2 px-3 py-1.5 text-sm text-ink-muted">
        <Phone className="size-4 text-success" aria-hidden="true" />
        <span className="font-semibold text-ink">{call.starterName}</span> começou uma chamada
        <time dateTime={call.createdAt.toISOString()} className="text-xs text-ink-subtle">
          {messageTime(call.createdAt)}
        </time>
      </span>
    </li>
  );
}

function Run({ run, selfId, showNames }: { run: MessageRun; selfId: string; showNames: boolean }) {
  return (
    <>
      {run.messages.map((message, index) => (
        <MessageItem
          key={message.id}
          message={message}
          first={index === 0}
          own={message.authorId === selfId}
          showName={showNames}
        />
      ))}
    </>
  );
}

/** The conversation, oldest first: a divider per day, then runs of the same person. */
export function MessageTimeline({
  messages,
  calls = [],
  selfId,
  showNames = false,
}: {
  messages: readonly TimelineMessage[];
  calls?: readonly TimelineCall[];
  selfId: string;
  /** In groups, whose bubble it is. */
  showNames?: boolean;
}) {
  const now = useNow();
  const days = groupTimeline(messages, now, calls);
  if (days.length === 0) {
    return <p className="px-4 py-10 text-center text-sm text-ink-muted">Nenhuma mensagem ainda.</p>;
  }
  return (
    <ol aria-label="Mensagens" className="flex flex-col pb-2">
      {days.map((day) => (
        <li key={day.key}>
          <p className="mt-5 flex justify-center px-3">
            <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold text-ink-muted">
              {day.label}
            </span>
          </p>
          <ul>
            {day.runs.map((run) =>
              run.type === "call" ? (
                <CallLine key={run.id} call={run} />
              ) : (
                <Run key={run.messages[0]?.id} run={run} selfId={selfId} showNames={showNames} />
              ),
            )}
          </ul>
        </li>
      ))}
    </ol>
  );
}
