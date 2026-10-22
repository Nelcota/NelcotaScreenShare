import { useEffect, useState, type DragEvent } from "react";
import { callToast as toast } from "@/features/room/client/call-notices";
import {
  chatImageErrorMessage,
  ChatImageTooHeavyError,
  prepareChatImage,
} from "@/features/room/client/prepare-chat-image";
import { chatImageProblem } from "@/features/room/domain/chat-images";
import { reportBrowserError } from "@/lib/telemetry.client";

/** The image waiting in the box, with the preview shown there until it goes. */
export interface ChatAttachment {
  file: File;
  preview: string;
}

/**
 * The image picked, pasted or dropped into the chat: it waits in the box with a
 * preview, and goes with the next Enter, together with the text typed next to it.
 */
export function useChatAttachment() {
  const [attached, setAttached] = useState<ChatAttachment>();
  // Reducing a big photo takes a moment: Enter waits for it.
  const [preparing, setPreparing] = useState(false);

  // Each preview is freed when another image replaces it or the box empties.
  useEffect(() => {
    if (!attached) return;
    return () => URL.revokeObjectURL(attached.preview);
  }, [attached]);

  /**
   * Checks the image (type and size), reduces it when it is too big to go, and lets it
   * wait in the box; says why when it cannot.
   */
  async function attach(picked: File) {
    const problem = chatImageProblem(picked);
    if (problem) {
      toast.error(problem);
      return;
    }
    setPreparing(true);
    try {
      const file = await prepareChatImage(picked);
      setAttached({ file, preview: URL.createObjectURL(file) });
    } catch (error) {
      // Too heavy even reduced is the person's file, not a fault to report.
      if (!(error instanceof ChatImageTooHeavyError)) reportBrowserError(error);
      toast.error(chatImageErrorMessage(error));
    } finally {
      setPreparing(false);
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
