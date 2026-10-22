import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { textPreview } from "@/features/room/domain/chat-files";
import { cn } from "@/lib/utils";

/** Saves the text as a plain .txt: never opened as a page, whatever it contains. */
function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

const sizeFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

function readableSize(text: string): string {
  const kilobytes = new TextEncoder().encode(text).byteLength / 1024;
  if (kilobytes < 1024) return `${sizeFormat.format(Math.max(kilobytes, 0.1))} KB`;
  return `${sizeFormat.format(kilobytes / 1024)} MB`;
}

/**
 * A text file sent in the call chat: its name and size, the first lines as plain text
 * (links included, never clickable) and "Baixar". It lives only in this browser's memory.
 */
export function ChatFileCard({
  file,
  mine,
}: {
  file: { name: string; text: string };
  mine: boolean;
}) {
  return (
    <div
      className={cn(
        "flex w-72 max-w-full flex-col gap-2 rounded-2xl border border-line bg-surface-3 p-3",
        mine ? "rounded-br-md" : "rounded-bl-md",
      )}
    >
      <p className="flex min-w-0 items-center gap-2 text-sm">
        <FileText className="size-4 shrink-0 text-brand-soft" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate font-medium text-ink">{file.name}</span>
        <span className="shrink-0 text-xs text-ink-subtle">{readableSize(file.text)}</span>
      </p>
      <pre
        aria-label={`Começo de ${file.name}`}
        className="max-h-40 overflow-hidden rounded-xl bg-surface-2 px-3 py-2 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap text-ink-muted"
      >
        {textPreview(file.text)}
      </pre>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => download(file.name, file.text)}
        className="self-start rounded-full"
      >
        <Download aria-hidden="true" />
        Baixar
      </Button>
    </div>
  );
}
