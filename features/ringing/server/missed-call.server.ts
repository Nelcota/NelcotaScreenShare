import { notifyUsers } from "@/features/live/server/live-bus.server";
import { openDirect } from "@/features/messages/server/conversations.server";
import { insertMessage } from "@/features/messages/server/messages.server";
import type { Database } from "@/server/db/index.server";

/**
 * A call to a friend who looks Offline: "Chamada perdida" in the pair's conversation, which
 * counts as unread until they open it. The caller sees it there too.
 */
export async function leaveMissedCall(db: Database, callerId: string, calleeId: string) {
  // Opened before, not in the same transaction: a first conversation would join both people
  // at the call's own instant, and the call would never count as unread.
  const conversationId = await openDirect(db, callerId, calleeId);
  await db.transaction(async (tx) => {
    await insertMessage(tx, conversationId, callerId, {
      kind: "missed_call",
      body: null,
      gifSlug: null,
    });
  });
  notifyUsers([callerId, calleeId], "messages");
}
