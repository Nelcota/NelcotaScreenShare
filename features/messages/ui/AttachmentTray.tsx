import { FileText, LoaderCircle, Paperclip, X } from "lucide-react";
import { useRef } from "react";
import { readableSize } from "@/features/messages/domain/attachments";
import type { AttachmentDraft } from "@/features/messages/hooks/use-attachment-draft";

/**
 * The file waiting above the message box (as in the call chat): its preview or icon, name
 * and size, and the X to drop it. While it is being sent, a spinner instead of the size.
 */
export function AttachmentTray({
  draft,
  onClear,
}: {
  draft: AttachmentDraft;
  onClear: () => void;
}) {
  const uploading = draft.status === "uploading";
  return (
    <div className="mb-2 flex items-center gap-3 rounded-2xl border border-line bg-surface-2 py-2 pr-2 pl-2">
      <span className="grid size-13 shrink-0 place-items-center overflow-hidden rounded-xl bg-brand/15 text-brand-soft">
        {draft.previewUrl === null ? (
          <FileText className="size-6" aria-hidden="true" />
        ) : (
          <img src={draft.previewUrl} alt="" className="size-full object-cover" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink">{draft.fileName}</span>
        <span className="flex items-center gap-1.5 text-xs text-ink-subtle">
          {uploading ? (
            <>
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
              Enviando…
            </>
          ) : (
            readableSize(draft.size)
          )}
        </span>
      </span>
      <button
        type="button"
        aria-label={`Tirar ${draft.fileName}`}
        onClick={onClear}
        className="grid size-9 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-ink/[0.07] hover:text-ink"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

/** The clip in the message box: picks one file, which then waits above the box. */
export function AttachButton({ onPick }: { onPick: (file: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        aria-label="Anexar arquivo"
        onClick={() => input.current?.click()}
        className="grid size-9 shrink-0 place-items-center rounded-xl text-ink-muted hover:bg-ink/[0.07] hover:text-ink"
      >
        <Paperclip className="size-5" aria-hidden="true" />
      </button>
      <input
        ref={input}
        type="file"
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Cleared, so picking the same file again still fires.
          event.target.value = "";
          if (file !== undefined) onPick(file);
        }}
      />
    </>
  );
}
