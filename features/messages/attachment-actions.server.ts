import { z } from "zod";
import { defineUserOperation } from "@/features/auth/server/operation-policies.server";
import { ATTACHMENT_LIMITS } from "@/features/messages/domain/attachments";
import {
  attachmentDownloadUrl,
  confirmAttachment as confirmAttachmentRow,
  requestAttachmentUpload as requestUploadRow,
  type AttachmentDeps,
} from "@/features/messages/server/attachments.server";
import { canMessage, membershipOf } from "@/features/messages/server/conversations.server";
import { getDb } from "@/server/db/index.server";
import { ActionError } from "@/server/operations/action-error";
import { createRateLimiter } from "@/server/rate-limit.server";
import { attachmentStorage } from "@/server/storage/attachment-storage.server";

const uploadSchema = z.object({
  conversationId: z.uuid(),
  fileName: z.string().min(1).max(1000),
  size: z.number().int().min(1).max(ATTACHMENT_LIMITS.owners),
});
const attachmentSchema = z.object({ attachmentId: z.uuid() });

/** A few files a minute is plenty; this only stops a flood of uploads. */
const uploadLimiter = createRateLimiter({ limit: 20, windowMs: 60_000 });

const OFF = "Anexos ainda não estão disponíveis.";
const FRIENDS_ONLY = "Só dá para mandar arquivo para amigos.";

function deps(): AttachmentDeps {
  const storage = attachmentStorage();
  if (storage === null) throw new ActionError(OFF);
  return { db: getDb(), storage };
}

/** A direct conversation only takes new files while the two are still friends. */
async function requireCanSend(conversationId: string, userId: string) {
  const db = getDb();
  const membership = await membershipOf(db, conversationId, userId);
  if (membership === null || membership.kind === "group") return;
  if (membership.otherId === null) throw new ActionError(FRIENDS_ONLY);
  if (!(await canMessage(db, userId, membership.otherId))) throw new ActionError(FRIENDS_ONLY);
}

/** Starts an upload: the browser then sends the file straight to the storage. */
export const requestAttachmentUpload = defineUserOperation(
  { name: "messages.attachment_upload", audit: "none" },
  uploadSchema,
  async ({ parsedInput, ctx }) => {
    const userId = ctx.current.user.id;
    if (!uploadLimiter.hit(userId).ok) {
      throw new ActionError("Muitos arquivos seguidos. Espere um pouco.");
    }
    const attachmentDeps = deps();
    await requireCanSend(parsedInput.conversationId, userId);
    return requestUploadRow(attachmentDeps, { userId, ...parsedInput });
  },
);

/** After the upload: the server measures the file and tells its type before it can be sent. */
export const confirmAttachment = defineUserOperation(
  { name: "messages.attachment_confirm", audit: "none" },
  attachmentSchema,
  async ({ parsedInput, ctx }) =>
    confirmAttachmentRow(deps(), { userId: ctx.current.user.id, ...parsedInput }),
);

/** A short link to download a file of a conversation the person is in. */
export const attachmentDownload = defineUserOperation(
  { name: "messages.attachment_download", audit: "none" },
  attachmentSchema,
  async ({ parsedInput, ctx }) => ({
    url: await attachmentDownloadUrl(deps(), { userId: ctx.current.user.id, ...parsedInput }),
  }),
);
