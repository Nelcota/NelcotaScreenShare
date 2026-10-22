import { ImagePlus } from "lucide-react";
import { useRef } from "react";
import { Hint } from "@/components/Hint";
import { Button } from "@/components/ui/button";
import { CHAT_IMAGE_TYPES } from "@/features/room/domain/chat-images";

/** Picks an image or a .txt to send in the call chat; the chat checks its type and size. */
export function ChatImageButton({
  busy,
  onImage,
}: {
  busy: boolean;
  onImage: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <Hint text="Anexar imagem (até 25 MB) ou .txt (até 1 MB)">
        <Button
          type="button"
          variant="quiet"
          size="icon"
          loading={busy}
          aria-label="Anexar imagem ou arquivo de texto"
          onClick={() => inputRef.current?.click()}
          className="size-9 shrink-0 rounded-full text-ink-muted"
        >
          {busy ? null : <ImagePlus className="size-5" aria-hidden="true" />}
        </Button>
      </Hint>
      <input
        ref={inputRef}
        type="file"
        accept={[...CHAT_IMAGE_TYPES, ".txt", "text/plain"].join(",")}
        hidden
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          // The same file picked twice still counts as a new choice.
          event.target.value = "";
          if (file) onImage(file);
        }}
      />
    </>
  );
}
