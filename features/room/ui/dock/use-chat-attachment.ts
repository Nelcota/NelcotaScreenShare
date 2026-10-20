import { useEffect, useState, type DragEvent } from "react";
import { callToast as toast } from "@/features/room/client/call-notices";
import { chatImageProblem } from "@/features/room/domain/chat-images";

/** The image waiting in the box, with the preview shown there until it goes. */
export interface ChatAttachment {
  file: File;
  preview: string;
}

/**
 * The image picked, pasted or dropped into the chat (#494): it waits in the box with a
 * preview, and goes with the next Enter, together with the text typed next to it.
 */
export function useChatAttachment() {
  const [attached, setAttached] = useState<ChatAttachment>();

  // Each preview is freed when another image replaces it or the box empties.
  useEffect(() => {
    if (!attached) return;
    return () => URL.revokeObjectURL(attached.preview);
  }, [attached]);

  /** Checks the image (type and size) before it waits in the box; says why when it cannot. */
  function attach(file: File) {
    const problem = chatImageProblem(file);
    if (problem) {
      toast.error(problem);
      return;
    }
    setAttached({ file, preview: URL.createObjectURL(file) });
  }

  return { attached, attach, clear: () => setAttached(undefined) };
}

function carriesFiles(event: DragEvent<HTMLElement>): boolean {
  return [...event.dataTransfer.types].includes("Files");
}

/** An image dragged from the computer onto the chat waits in the box like a picked one. */
export function useImageDrop(onImage: (file: File) => void, enabled: boolean) {
  const [dropping, setDropping] = useState(false);
  const handlers = {
    onDragOver: (event: DragEvent<HTMLElement>) => {
      if (!enabled || !carriesFiles(event)) return;
      event.preventDefault();
      setDropping(true);
    },
    onDragLeave: (event: DragEvent<HTMLElement>) => {
      // Moving over a child also leaves the parent: only leaving the panel counts.
      const into = event.relatedTarget;
      if (into instanceof Node && event.currentTarget.contains(into)) return;
      setDropping(false);
    },
    onDrop: (event: DragEvent<HTMLElement>) => {
      setDropping(false);
      if (!enabled || !carriesFiles(event)) return;
      event.preventDefault();
      const file = event.dataTransfer.files[0];
      if (file) onImage(file);
    },
  };
  return { dropping, handlers };
}
