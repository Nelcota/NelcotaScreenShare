import { answerJoinRequest, openJoinRequest } from "@/features/room/server/join-requests.server";
import { roomAccessOf } from "@/features/room/server/room-access.server";
import type { DbExecutor } from "@/server/db/index.server";

/**
 * In rooms that ask for approval, the ring is the approval: a request opened for the callee
 * and accepted by whoever rang, as a host would. The host's lock still applies at the door.
 */
export async function admitByRing(
  db: DbExecutor,
  ring: { roomCode: string; callerId: string },
  callee: { id: string; name: string },
) {
  if ((await roomAccessOf(db, ring.roomCode)) !== "approval") return null;
  const requestId = await openJoinRequest(db, {
    roomCode: ring.roomCode,
    requester: { userId: callee.id },
    displayName: callee.name,
  });
  if (!requestId) return null;
  const answered = await answerJoinRequest(db, {
    roomCode: ring.roomCode,
    requestId,
    deciderId: ring.callerId,
    accept: true,
  });
  return answered ? requestId : null;
}
