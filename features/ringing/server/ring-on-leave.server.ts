import { z } from "zod";
import { cancelRingsFromRoom } from "@/features/ringing/server/ring-service.server";
import { identitiesIn } from "@/features/room/server/livekit-gateway.server";
import { roomCodeForMedia } from "@/features/room/server/session-store.server";
import type { DbExecutor } from "@/server/db/index.server";
import { logger } from "@/server/logger.server";

const LEAVE_EVENTS = new Set(["participant_left", "participant_connection_aborted"]);

const leaveSchema = z.object({
  event: z.string(),
  room: z.object({ name: z.string().min(1) }),
  participant: z.object({ identity: z.uuid() }),
});

/** Still in the call from another tab or device: their rings keep going. */
async function stillConnected(mediaName: string, identity: string): Promise<boolean> {
  try {
    return (await identitiesIn(mediaName)).includes(identity);
  } catch (error) {
    logger.warn({ err: error }, "could not ask LiveKit who is in the call");
    return false;
  }
}

/**
 * Whoever rang a friend and left the call before the answer: the ring stops for the friend,
 * so nobody walks into an empty room. Returns how many rings stopped.
 */
export async function endRingsOnLeave(db: DbExecutor, event: unknown): Promise<number> {
  const parsed = leaveSchema.safeParse(event);
  if (!parsed.success || !LEAVE_EVENTS.has(parsed.data.event)) return 0;
  const { room, participant } = parsed.data;
  if (await stillConnected(room.name, participant.identity)) return 0;
  const code = await roomCodeForMedia(db, room.name);
  return cancelRingsFromRoom(participant.identity, code).length;
}
