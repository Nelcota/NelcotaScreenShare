import { managesRoomAccess } from "@/features/room/domain/room-access";
import { answerJoinRequest, openJoinRequest } from "@/features/room/server/join-requests.server";
import { roomAccessOf } from "@/features/room/server/room-access.server";
import { roomRoleOf } from "@/features/room/server/room-roles.server";
import { openControlSession } from "@/features/room/server/session-store.server";
import type { DbExecutor } from "@/server/db/index.server";

/**
 * Who decides who gets in: the owner, a moderator, or the host elected for this call (an open
 * control session only exists with host controls on).
 */
async function decidesEntry(db: DbExecutor, roomCode: string, userId: string): Promise<boolean> {
  if (managesRoomAccess(await roomRoleOf(db, { roomCode, userId }))) return true;
  return (await openControlSession(db, roomCode))?.hostUserId === userId;
}

/**
 * In rooms that ask for approval, a ring from whoever decides entry is the approval: a
 * request opened for the callee and accepted by them, as a host would. Anyone else in the
 * call can still ring a friend, who then asks like everyone else ("Pedido enviado"). The
 * host's lock still applies at the door.
 */
export async function admitByRing(
  db: DbExecutor,
  ring: { roomCode: string; callerId: string },
  callee: { id: string; name: string },
) {
  if ((await roomAccessOf(db, ring.roomCode)) !== "approval") return null;
  if (!(await decidesEntry(db, ring.roomCode, ring.callerId))) return null;
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
