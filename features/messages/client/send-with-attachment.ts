import type { ReadyAttachment } from "@/features/messages/client/upload-attachment";

/** What sending a message with a file needs from the box. */
export interface AttachmentSend {
  conversationId: string;
  body: string;
  attachment: ReadyAttachment;
  /** Sends; true when the server took it. */
  deliver: (input: {
    conversationId: string;
    attachmentId: string;
    body: string;
  }) => Promise<boolean>;
  /** Empties the box at once, so the next message can be typed. */
  clear: () => void;
  /** Puts the text and the file back when sending failed. */
  restore: (body: string, attachment: ReadyAttachment) => void;
}

/**
 * Sends the waiting file with the text. The box empties at once; if the server refuses, the
 * text and the file come back, so nothing has to be picked or typed again.
 */
export async function sendWithAttachment(send: AttachmentSend): Promise<boolean> {
  send.clear();
  const sent = await send.deliver({
    conversationId: send.conversationId,
    attachmentId: send.attachment.attachmentId,
    body: send.body,
  });
  if (!sent) send.restore(send.body, send.attachment);
  return sent;
}
