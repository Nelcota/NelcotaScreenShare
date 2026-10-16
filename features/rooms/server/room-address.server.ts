import { eq, sql } from "drizzle-orm";
import type { DbExecutor } from "@/server/db/index.server";
import { roomDefinitions } from "@/server/db/schema/room-control";
import { rooms } from "@/server/db/schema/rooms";
import { ActionError } from "@/server/operations/action-error";
import {
  ADDRESS_IN_USE_MESSAGE,
  RESERVED_ADDRESS_MESSAGE,
  usesReservedWord,
} from "@/features/rooms/domain/room-address";

/** A permanent room's address when none is chosen: drawn, as before #388. */
export function drawnRoomAddress(): string {
  return `sala-${crypto.randomUUID().replaceAll("-", "").slice(0, 24)}`;
}

/** Has this code ever named a room, permanent or for a single call? Codes are never reused (ADR 0007). */
async function addressTaken(tx: DbExecutor, code: string): Promise<boolean> {
  const [definition] = await tx
    .select({ code: roomDefinitions.code })
    .from(roomDefinitions)
    .where(eq(roomDefinitions.code, code))
    .limit(1);
  if (definition) return true;
  const [room] = await tx
    .select({ code: rooms.code })
    .from(rooms)
    .where(eq(rooms.code, code))
    .limit(1);
  return room !== undefined;
}

/**
 * Checks a chosen address before the room takes it: reserved words only for whoever may use
 * them, and never one that already names a room.
 */
export async function claimRoomAddress(
  tx: DbExecutor,
  code: string,
  mayUseReservedWords: boolean,
): Promise<void> {
  if (usesReservedWord(code) && !mayUseReservedWords) {
    throw new ActionError(RESERVED_ADDRESS_MESSAGE);
  }
  // Two people choosing the same address at once: the second waits here and finds it taken.
  // The same key as opening a room by its code (room-lifecycle.server.ts).
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`nelcota:room:${code}`}, 0))`,
  );
  if (await addressTaken(tx, code)) throw new ActionError(ADDRESS_IN_USE_MESSAGE);
}
