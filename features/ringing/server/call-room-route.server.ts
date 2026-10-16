import { getUserSession } from "@/features/auth/server/participant-session.server";
import { currentCallRoom } from "@/features/ringing/server/ringing-state.server";
import { getDb } from "@/server/db/index.server";

/**
 * The room of the call the signed-in person is in, alone: what the pre-join checks every few
 * seconds to ring a waiting friend, without reloading every loader on the page.
 */
export async function callRoomState() {
  const session = await getUserSession();
  if (!session) return Response.json({ callRoom: null }, { status: 401 });
  const callRoom = await currentCallRoom(getDb(), session.user.id);
  return Response.json({ callRoom }, { headers: { "Cache-Control": "no-store" } });
}
