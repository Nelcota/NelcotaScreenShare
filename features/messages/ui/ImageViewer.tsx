import { Download, X, ZoomIn, ZoomOut } from "lucide-react";
import { Dialog } from "radix-ui";
import { useState, type MouseEvent } from "react";
import { messageTime } from "@/features/messages/domain/timeline";
import { initials } from "@/lib/initials";
import { cn } from "@/lib/utils";

const TOOL =
  "grid size-10 place-items-center rounded-[0.625rem] text-white/90 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white";

/** Where the click landed, in percent of the image, so the zoom grows from there. */
function originOf(event: MouseEvent<HTMLElement>): string {
  const box = event.currentTarget.getBoundingClientRect();
  if (box.width === 0 || box.height === 0) return "center";
  const x = ((event.clientX - box.left) / box.width) * 100;
  const y = ((event.clientY - box.top) / box.height) * 100;
  return `${x}% ${y}%`;
}

/**
 * A photo from the conversation, full screen: who sent it and when on the top left; zoom,
 * download and close on the top right. A click on the photo zooms in from that point and
 * another zooms out; a click outside it or Esc closes.
 */
export function ImageViewer({
  open,
  onOpenChange,
  src,
  fileName,
  authorName,
  sentAt,
  onDownload,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string;
  fileName: string;
  authorName: string;
  sentAt: Date;
  onDownload: () => void;
}) {
  const [zoom, setZoom] = useState<{ origin: string } | null>(null);
  const toggleZoom = (origin: string) => setZoom((current) => (current ? null : { origin }));
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) setZoom(null);
        onOpenChange(next);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          // A click on the dark area around the photo closes, as in the image viewers people know.
          onClick={(event) => {
            if (event.target === event.currentTarget) onOpenChange(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden outline-none"
        >
          <Dialog.Title className="sr-only">{fileName}</Dialog.Title>
          <div className="pointer-events-none absolute top-3 left-3 flex items-center gap-2.5 text-white sm:top-4 sm:left-5">
            <span className="grid size-10 place-items-center rounded-full bg-brand/40 text-sm font-semibold">
              {initials(authorName)}
            </span>
            <span className="min-w-0">
              <span className="block text-[0.9375rem] font-semibold">{authorName}</span>
              <span className="block text-xs text-white/70">
                {messageTime(sentAt)}
                <span className="max-sm:hidden"> · {fileName}</span>
              </span>
            </span>
          </div>
          <div className="absolute top-3 right-3 flex gap-2 sm:top-4 sm:right-5">
            <div className="flex gap-0.5 rounded-xl border border-white/15 bg-neutral-900/90 p-0.5">
              <button
                type="button"
                aria-label={zoom ? "Diminuir" : "Ampliar"}
                onClick={() => toggleZoom("center")}
                className={TOOL}
              >
                {zoom ? (
                  <ZoomOut className="size-5" aria-hidden="true" />
                ) : (
                  <ZoomIn className="size-5" aria-hidden="true" />
                )}
              </button>
              <button type="button" aria-label="Baixar" onClick={onDownload} className={TOOL}>
                <Download className="size-5" aria-hidden="true" />
              </button>
            </div>
            <Dialog.Close
              aria-label="Fechar"
              className={cn(TOOL, "rounded-xl border border-white/15 bg-neutral-900/90")}
            >
              <X className="size-5" aria-hidden="true" />
            </Dialog.Close>
          </div>
          <button
            type="button"
            aria-label={zoom ? "Diminuir a foto" : "Ampliar a foto"}
            onClick={(event) => toggleZoom(originOf(event))}
            style={zoom ? { transformOrigin: zoom.origin } : undefined}
            className={cn(
              "rounded-lg transition-transform duration-200 focus-visible:outline-2 focus-visible:outline-white motion-reduce:transition-none",
              zoom ? "scale-[2.2] cursor-zoom-out" : "cursor-zoom-in",
            )}
          >
            <img
              src={src}
              alt={fileName}
              className="block max-h-[78vh] max-w-[94vw] rounded-lg object-contain sm:max-w-[80vw]"
            />
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
