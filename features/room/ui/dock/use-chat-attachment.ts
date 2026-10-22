import { useEffect, useRef, useState, type DragEvent } from "react";
import { callToast as toast } from "@/features/room/client/call-notices";
import {
  chatImageErrorMessage,
  ChatImageTooHeavyError,
  prepareChatImage,
} from "@/features/room/client/prepare-chat-image";
import {
  isTextFileName,
  notPlainTextMessage,
  plainText,
  textFileProblem,
} from "@/features/room/domain/chat-files";
import { chatImageProblem } from "@/features/room/domain/chat-images";
import { reportBrowserError } from "@/lib/telemetry.client";

/**
 * What waits in the box until it goes: an image with its preview, or a text file
 * whose plain text was already read and checked.
 */
export type ChatAttachment =
  | { kind: "image"; file: File; preview: string }
  | { kind: "text"; file: File; text: string };

/**
 * The image picked, pasted or dropped into the chat: it waits in the box with a
 * preview, and goes with the next Enter, together with the text typed next to it.
 */
export function useChatAttachment() {
  const [attached, setAttached] = useState<ChatAttachment>();
  // Reducing a big photo takes a moment: Enter waits for it.
  const [preparing, setPreparing] = useState(false);
  // Counts the files handed in: only the last one may land in the box.
  const latest = useRef(0);

  // Each preview is freed when another image replaces it or the box empties.
  useEffect(() => {
    if (attached?.kind !== "image") return;
    return () => URL.revokeObjectURL(attached.preview);
  }, [attached]);

  /** A .txt waits in the box only when it is plain text within 1 MB. */
  async function attachText(picked: File) {
    const problem = textFileProblem(picked);
    if (problem) {
      toast.error(problem);
      return;
    }
    // Like a picture, it replaces one still being reduced, which then never lands.
    const turn = ++latest.current;
    setPreparing(true);
    try {
      const text = plainText(new Uint8Array(await picked.arrayBuffer()));
      if (turn !== latest.current) return;
      if (text === undefined) {
        toast.error(notPlainTextMessage());
        return;
      }
      setAttached({ kind: "text", file: picked, text });
    } finally {
      if (turn === latest.current) setPreparing(false);
    }
  }

  /**
   * Checks the image (type and size), reduces it when it is too big to go, and lets it
   * wait in the box; says why when it cannot.
   */
  async function attach(picked: File) {
    if (isTextFileName(picked.name)) {
      await attachText(picked);
      return;
    }
    const problem = chatImageProblem(picked);
    if (problem) {
      toast.error(problem);
      return;
    }
    // A paste or drop while a big picture is reduced replaces it: the earlier one, when it
    // finishes, neither lands in the box nor ends the wait of the newer one.
    const turn = ++latest.current;
    setPreparing(true);
    try {
      const file = await prepareChatImage(picked);
      if (turn !== latest.current) return;
      setAttached({ kind: "image", file, preview: URL.createObjectURL(file) });
    } catch (error) {
      if (turn !== latest.current) return;
      // Too heavy even reduced is the person's file, not a fault to report.
      if (!(error instanceof ChatImageTooHeavyError)) reportBrowserError(error);
      toast.error(chatImageErrorMessage(error));
    } finally {
      if (turn === latest.current) setPreparing(false);
    }
  }

  return {
    attached,
    preparing,
    attach: (file: File) => void attach(file),
    clear: () => setAttached(undefined),
  };
}

function carriesFiles(event: DragEvent<HTMLElement>): boolean {
  return [...event.dataTransfer.types].includes("Files");
}

/** An image dragged from the computer onto the chat waits in the box like a picked one. */
export function useImageDrop(onImage: (file: File) => void, enabled: boolean) {
  const [dropping, setDropping] = useState(false);
  const handlers = {
    onDragOver: (event: DragEvent<HTMLElement>) => {
      if (!carriesFiles(event)) return;
      // Always taken here: left to the browser, a dropped file opens and the call is gone.
      event.preventDefault();
      if (enabled) setDropping(true);
    },
    onDragLeave: (event: DragEvent<HTMLElement>) => {
      // Moving over a child also leaves the parent: only leaving the panel counts.
      const into = event.relatedTarget;
      if (into instanceof Node && event.currentTarget.contains(into)) return;
      setDropping(false);
    },
    onDrop: (event: DragEvent<HTMLElement>) => {
      setDropping(false);
      if (!carriesFiles(event)) return;
      event.preventDefault();
      // Editing a message: the file is ignored, never opened.
      if (!enabled) return;
      const file = event.dataTransfer.files[0];
      if (file !== undefined) onImage(file);
    },
  };
  return { dropping, handlers };
}
