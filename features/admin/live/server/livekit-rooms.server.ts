import { logger } from "@/server/logger.server";
import { roomService } from "@/features/room/server/room-service.server";
import { roomCodesForMedia } from "@/features/room/server/session-store.server";
import { getDb } from "@/server/db/index.server";

const LIST_TIMEOUT_MS = 3_000;

/** Lists the codes of the rooms in LiveKit; injectable so tests do not need a server. */
type ListLiveKitRoomNames = (codes?: string[]) => Promise<string[]>;

const listLiveKitRoomNames: ListLiveKitRoomNames = async (codes) => {
  const rooms = await roomService().listRooms(codes);
  // With host controls a call is named after its session, not its code.
  return roomCodesForMedia(
    getDb(),
    rooms.map((room) => room.name),
  );
};

/** Codes of the rooms open in LiveKit now, or `null` when it does not answer in time. */
export async function liveKitRoomNames(
  list: ListLiveKitRoomNames = listLiveKitRoomNames,
): Promise<Set<string> | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), LIST_TIMEOUT_MS);
  });
  try {
    return new Set(await Promise.race([list(), timeout]));
  } catch (error) {
    logger.warn(
      { failure: error instanceof Error ? error.name : "unknown" },
      "admin live: LiveKit room list unavailable",
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}
