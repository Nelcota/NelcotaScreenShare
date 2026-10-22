import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  previewsAsImage,
  uploadAttachment,
  type ReadyAttachment,
} from "@/features/messages/client/upload-attachment";

/** The file waiting above the message box: sending, or checked and ready to go. */
export type AttachmentDraft =
  | { status: "uploading"; fileName: string; size: number; previewUrl: string | null }
  | ({ status: "ready"; previewUrl: string | null } & ReadyAttachment);

/**
 * The file picked for the next message: sent at once, so it is ready when Enter goes. A new
 * pick or the X drops the previous one; a failed upload says why and leaves the box empty.
 */
export function useAttachmentDraft(conversationId: string) {
  const [draft, setDraft] = useState<AttachmentDraft | null>(null);
  // Only the latest pick may land: an older upload finishing late is ignored.
  const latest = useRef(0);

  // The local preview of an image is freed when it is replaced or the box goes away.
  const previewUrl = draft?.previewUrl ?? null;
  useEffect(() => {
    if (previewUrl === null) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const pick = async (file: File) => {
    const attempt = latest.current + 1;
    latest.current = attempt;
    const preview = previewsAsImage(file) ? URL.createObjectURL(file) : null;
    setDraft({ status: "uploading", fileName: file.name, size: file.size, previewUrl: preview });
    const result = await uploadAttachment(conversationId, file);
    if (latest.current !== attempt) return;
    if (!result.ok) {
      setDraft(null);
      toast.error(result.message);
      return;
    }
    setDraft({ status: "ready", previewUrl: preview, ...result.attachment });
  };

  const clear = () => {
    latest.current += 1;
    setDraft(null);
  };

  const ready = draft?.status === "ready" ? draft : null;
  return { draft, ready, uploading: draft?.status === "uploading", pick, clear };
}
