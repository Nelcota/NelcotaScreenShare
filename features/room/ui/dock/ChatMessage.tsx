import { Copy, Ellipsis, Pencil, Trash2 } from "lucide-react";
import { Fragment } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { chatParts } from "@/features/room/domain/chat-format";
import { participantLabel } from "@/features/room/domain/participant-label";
import type { ChatEntry } from "@/features/room/hooks/use-chat-state";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { InitialsAvatar } from "@/components/InitialsAvatar";
import { ChatFileCard } from "./ChatFileCard";
import { ChatImageBubble } from "./ChatImageBubble";

const timeFormat = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** A message: yours on the right in green; others' on the left, with an avatar. */
export function ChatMessage({
  message,
  groupStart,
  editing,
  onEdit,
  onDelete,
  onCopy,
}: {
  message: ChatEntry;
  groupStart: boolean;
  editing: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onCopy: () => void;
}) {
  const { mine } = message;
  const name = participantLabel(message.from);
  return (
    <li
      className={cn(
        "group/message flex gap-2",
        mine && "flex-row-reverse",
        // The first one pushes the rest down: a few messages sit right next to the field.
        groupStart ? "mt-3 first:mt-auto" : "mt-1",
      )}
    >
      {mine ? null : (
        <InitialsAvatar
          name={name}
          source={null}
          className={cn(
            "size-7 shrink-0 self-end bg-brand/20 text-xs font-medium text-brand-soft",
            !groupStart && "invisible",
          )}
        />
      )}
      <div className={cn("flex max-w-[80%] min-w-0 flex-col gap-1", mine && "items-end")}>
        {groupStart ? (
          <p className={cn("flex items-baseline gap-2 px-1 text-xs", mine && "flex-row-reverse")}>
            <span className="font-medium text-ink">{name}</span>
            <time dateTime={new Date(message.timestamp).toISOString()} className="text-ink-subtle">
              {timeFormat.format(message.timestamp)}
            </time>
          </p>
        ) : (
          <span className="sr-only">{name}:</span>
        )}
        <div className={cn("flex max-w-full items-center gap-1", mine && "flex-row-reverse")}>
          {message.image || message.file ? (
            <SharedMessage message={message} senderName={name} />
          ) : message.deleted ? (
            <p className="flex items-center gap-1.5 rounded-2xl border border-dashed border-line-strong px-3.5 py-2 text-sm text-ink-subtle italic">
              {mine ? "Você apagou esta mensagem" : "Mensagem apagada"}
            </p>
          ) : (
            <>
              <MessageText text={message.text} mine={mine} editing={editing} />
              <MessageMenu mine={mine} onEdit={onEdit} onDelete={onDelete} onCopy={onCopy} />
            </>
          )}
        </div>
        {message.edited && !message.deleted ? (
          <span className="px-1 text-xs text-ink-subtle">editada</span>
        ) : null}
      </div>
    </li>
  );
}

/** An image or a text file, with the text sent with it above, in one message. */
function SharedMessage({ message, senderName }: { message: ChatEntry; senderName: string }) {
  const { mine, text, image, file } = message;
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", mine && "items-end")}>
      {text ? <MessageText text={text} mine={mine} editing={false} /> : null}
      {image ? <ChatImageBubble image={image} mine={mine} senderName={senderName} /> : null}
      {file ? <ChatFileCard file={file} mine={mine} /> : null}
    </div>
  );
}

/** The message's text, with its links clickable; yours in green. */
function MessageText({ text, mine, editing }: { text: string; mine: boolean; editing: boolean }) {
  return (
    <p
      className={cn(
        "min-w-0 rounded-2xl px-3.5 py-2 text-[0.9375rem] leading-snug break-words whitespace-pre-wrap transition-shadow",
        mine ? "rounded-br-md bg-brand text-brand-ink" : "rounded-bl-md bg-surface-3 text-ink",
        editing && "ring-2 ring-brand-soft ring-offset-2 ring-offset-surface",
      )}
    >
      {chatParts(text).map((part, index) =>
        part.type === "link" ? (
          <a
            key={index}
            href={part.value}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium break-all underline underline-offset-2"
          >
            {part.value}
          </a>
        ) : (
          <Fragment key={index}>{part.value}</Fragment>
        ),
      )}
    </p>
  );
}

/** "⋮" next to the message: shows on hover/focus; on touch screens, always. */
function MessageMenu({
  mine,
  onEdit,
  onDelete,
  onCopy,
}: {
  mine: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onCopy: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="quiet"
          size="icon-sm"
          aria-label="Ações da mensagem"
          className="text-ink-subtle opacity-0 group-hover/message:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 [@media(hover:none)]:opacity-100"
        >
          <Ellipsis aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={mine ? "end" : "start"}
        className="w-auto min-w-40 rounded-xl border border-line-strong bg-surface p-1 shadow-soft"
      >
        {mine ? (
          <DropdownMenuItem onSelect={onEdit} className="gap-2.5 rounded-lg px-2.5 py-2">
            <Pencil aria-hidden="true" />
            Editar
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onSelect={onCopy} className="gap-2.5 rounded-lg px-2.5 py-2">
          <Copy aria-hidden="true" />
          Copiar
        </DropdownMenuItem>
        {mine ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={onDelete}
              className="gap-2.5 rounded-lg px-2.5 py-2"
            >
              <Trash2 aria-hidden="true" />
              Apagar
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
