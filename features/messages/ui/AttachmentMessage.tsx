import { Download, FileText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { attachmentDownload } from "@/features/messages/actions";
import {
  kindLabel,
  readableSize,
  type MessageAttachment,
} from "@/features/messages/domain/attachments";
import type { TimelineMessage } from "@/features/messages/domain/timeline";
import { BubbleTime } from "@/features/messages/ui/BubbleTime";
import { ImageViewer } from "@/features/messages/ui/ImageViewer";
import { cn } from "@/lib/utils";

/** Asks the server for a short link (members only) and lets the browser save the file. */
async function download(attachmentId: string) {
  const result = await attachmentDownload({ attachmentId });
  if (!result.data) {
    toast.error(result.serverError ?? "Não foi possível baixar agora.");
    return;
  }
  const link = document.createElement("a");
  link.href = result.data.url;
  link.rel = "noopener";
  link.click();
}

/** A photo in the conversation: no button on it; a click opens it full screen. */
function PhotoAttachment({
  attachment,
  src,
  message,
  own,
}: {
  attachment: MessageAttachment;
  src: string;
  message: TimelineMessage;
  own: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label={`Abrir ${attachment.fileName}`}
        onClick={() => setOpen(true)}
        className="relative block cursor-zoom-in overflow-hidden rounded-2xl border border-line bg-surface-2 p-1 shadow-xs focus-visible:outline-2 focus-visible:outline-brand"
      >
        <img
          src={src}
          alt={attachment.fileName}
          loading="lazy"
          className="block max-h-80 w-56 rounded-[0.875rem] object-cover sm:w-64"
        />
        <BubbleTime at={message.createdAt} own={own} overlay />
      </button>
      <ImageViewer
        open={open}
        onOpenChange={setOpen}
        src={src}
        fileName={attachment.fileName}
        authorName={message.authorName}
        sentAt={message.createdAt}
        onDownload={() => void download(attachment.id)}
      />
    </>
  );
}

/** Any other file: the whole card downloads it, with the icon in its corner. */
function FileAttachment({ attachment, own }: { attachment: MessageAttachment; own: boolean }) {
  return (
    <button
      type="button"
      aria-label={`Baixar ${attachment.fileName}`}
      onClick={() => void download(attachment.id)}
      className={cn(
        "flex w-72 max-w-full items-center gap-3 rounded-2xl border border-line bg-surface-3 px-3 py-2.5 text-left shadow-xs hover:border-brand/50 focus-visible:outline-2 focus-visible:outline-brand",
        own ? "rounded-br-md" : "rounded-bl-md",
      )}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-[0.625rem] bg-brand/15 text-brand-soft">
        <FileText className="size-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink">{attachment.fileName}</span>
        <span className="block text-xs text-ink-subtle">
          {kindLabel(attachment.kind)} · {readableSize(attachment.size)}
        </span>
      </span>
      <Download className="size-4.5 shrink-0 text-ink-muted" aria-hidden="true" />
    </button>
  );
}

/**
 * A message with a file: the name of whoever sent it (in groups), the text above if any, and
 * the photo or the file card.
 */
export function AttachmentMessage({
  message,
  attachment,
  own,
  showName,
  first,
}: {
  message: TimelineMessage;
  attachment: MessageAttachment;
  own: boolean;
  showName: boolean;
  first: boolean;
}) {
  return (
    <div
      className={cn(
        "flex max-w-[min(80%,34rem)] flex-col gap-1.5",
        own ? "items-end" : "items-start",
      )}
    >
      {first && showName && !own ? (
        <p className="px-1 text-xs font-semibold text-brand-soft">{message.authorName}</p>
      ) : null}
      {message.body ? (
        <p
          className={cn(
            "rounded-2xl px-3 py-2 text-[0.9375rem] leading-snug [overflow-wrap:anywhere] whitespace-pre-wrap shadow-xs",
            own ? "bg-brand text-brand-ink" : "border border-line bg-surface-2 text-ink",
            first && (own ? "rounded-tr-md" : "rounded-tl-md"),
          )}
        >
          {message.body}
          <BubbleTime at={message.createdAt} own={own} />
        </p>
      ) : null}
      {attachment.kind === "image" && attachment.previewUrl !== null ? (
        <PhotoAttachment
          attachment={attachment}
          src={attachment.previewUrl}
          message={message}
          own={own}
        />
      ) : (
        <FileAttachment attachment={attachment} own={own} />
      )}
    </div>
  );
}
