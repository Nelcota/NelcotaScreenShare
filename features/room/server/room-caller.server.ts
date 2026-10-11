import { GUEST_IDENTITY_PREFIX } from "@/features/room/domain/participant-label";
import { readGuestId } from "@/features/room/server/guest-session.server";
import { getUserAuth } from "@/features/auth/server/participant-auth.server";

/** Who is calling a room route: an active account or a guest, by their LiveKit identity. */
export type RoomCaller =
  | { kind: "account"; identity: string }
  | { kind: "guest"; identity: string };

/**
 * The caller's own identity in the room: the signed-in account, or the guest from the
 * signed cookie. Routes that change a participant (hand, name) act only on this identity,
 * never on one sent by the browser. Blocked or deleted accounts get none.
 */
export async function roomCaller(request: Request): Promise<RoomCaller | undefined> {
  const auth = await getUserAuth().api.getSession({ headers: request.headers });
  if (auth) {
    if (auth.user.blockedAt || auth.user.deletedAt) return undefined;
    return { kind: "account", identity: auth.user.id };
  }
  const guestId = await readGuestId(request);
  if (guestId === undefined) return undefined;
  return { kind: "guest", identity: `${GUEST_IDENTITY_PREFIX}${guestId}` };
}
