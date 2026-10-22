import { confirmAttachment, requestAttachmentUpload } from "@/features/messages/actions";
import type { AttachmentKind } from "@/features/messages/domain/attachments";

/** A file the server checked and that can now go with a message. */
export interface ReadyAttachment {
  attachmentId: string;
  fileName: string;
  kind: AttachmentKind;
  size: number;
}

export type UploadResult =
  | { ok: true; attachment: ReadyAttachment }
  | { ok: false; message: string };

const FAILED = "Não foi possível enviar o arquivo agora.";

/**
 * Sends a file the way ADR 0011 describes: the server hands a signed link, the browser sends
 * the file straight to the storage, and the server measures it and tells its type before it
 * can be sent in a message.
 */
export async function uploadAttachment(conversationId: string, file: File): Promise<UploadResult> {
  const started = await requestAttachmentUpload({
    conversationId,
    fileName: file.name,
    size: file.size,
  });
  if (!started.data) return { ok: false, message: started.serverError ?? FAILED };

  const sent = await fetch(started.data.uploadUrl, { method: "PUT", body: file }).catch(() => null);
  if (sent === null || !sent.ok) return { ok: false, message: FAILED };

  const checked = await confirmAttachment({ attachmentId: started.data.attachmentId });
  if (!checked.data) return { ok: false, message: checked.serverError ?? FAILED };
  return { ok: true, attachment: checked.data };
}

/** Raster images get a preview in the box; SVG never does (it is only a file here). */
export function previewsAsImage(file: File): boolean {
  return ["image/png", "image/jpeg", "image/gif", "image/webp"].includes(file.type);
}
