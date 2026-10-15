import { and, eq } from "drizzle-orm";
import type { Database } from "@/server/db/index.server";
import { roomCommands, roomSessionMembers } from "@/server/db/schema/room-control";
import { applyRoomCommand } from "./control-commands.server";
import { lockControlRoom, openControlSession } from "./session-store.server";

/** Who removes someone from a call: an account in the room, or an admin from the panel. */
export type ExclusionAuthor = { userId: string } | { adminId: string };

export type ExclusionResult = "excluded" | "no_call" | "not_in_call";

/**
 * "Banir desta chamada" with host controls on: the person is excluded from the open session,
 * as the host's removal does, and a transport command disconnects them. The relay refuses
 * them on every handshake until the call ends. Kept apart from the host command so the owner,
 * a moderator or an admin can ban without being the host.
 */
export async function excludeFromSession(
  db: Database,
  { roomCode, identity, by }: { roomCode: string; identity: string; by: ExclusionAuthor },
): Promise<ExclusionResult> {
  const commandId = await db.transaction(async (tx) => {
    await lockControlRoom(tx, roomCode);
    const session = await openControlSession(tx, roomCode);
    if (!session) return "no_call" as const;
    const [excluded] = await tx
      .update(roomSessionMembers)
      .set({
        excludedAt: new Date(),
        excludedByUserId: "userId" in by ? by.userId : null,
        excludedByAdminId: "adminId" in by ? by.adminId : null,
      })
      .where(
        and(
          eq(roomSessionMembers.sessionId, session.id),
          eq(roomSessionMembers.identity, identity),
        ),
      )
      .returning({ identity: roomSessionMembers.identity });
    if (!excluded) return "not_in_call" as const;
    const [command] = await tx
      .insert(roomCommands)
      .values({ sessionId: session.id, kind: "remove", targetIdentity: identity })
      .returning({ id: roomCommands.id });
    if (!command) throw new Error("Room command was not saved");
    return command.id;
  });
  if (commandId === "no_call" || commandId === "not_in_call") return commandId;
  // The exclusion holds once committed; a failed disconnect is retried by maintenance.
  await applyRoomCommand(db, commandId);
  return "excluded";
}
