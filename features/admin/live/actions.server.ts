import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { defineAdminOperation } from "@/features/auth/server/operation-policies.server";
import { ActionError } from "@/server/operations/action-error";
import { getDb } from "@/server/db/index.server";
import { rooms } from "@/server/db/schema";
import { closeGhostRoom } from "./server/close-ghost.server";
import { liveKitRoomNames } from "./server/livekit-rooms.server";

/**
 * Closes a "ghost" room: live in the panel, gone from LiveKit. The server asks LiveKit
 * again before closing, so a room with people in it is never ended from here.
 */
export const closeGhostRoomAction = defineAdminOperation(
  { name: "live.closeGhost", permission: { live: ["close"] }, audit: "required" },
  z.object({ id: z.uuid() }),
  async ({ parsedInput, ctx }) => {
    const db = getDb();
    const [room] = await db
      .select({ code: rooms.code })
      .from(rooms)
      .where(
        and(eq(rooms.id, parsedInput.id), eq(rooms.status, "active"), isNull(rooms.deletedAt)),
      );
    if (!room) throw new ActionError("Essa sala já foi encerrada.");

    const open = await liveKitRoomNames();
    if (!open) throw new ActionError("O LiveKit não respondeu. Tente de novo em instantes.");
    if (open.has(room.code)) {
      throw new ActionError("Essa sala ainda está aberta no LiveKit.");
    }

    const closed = await db.transaction(async (tx) => {
      const ghost = await closeGhostRoom(
        tx,
        { id: parsedInput.id, code: room.code },
        ctx.admin.user.id,
      );
      if (!ghost)
        throw new ActionError("Essa sala teve atividade agora há pouco ou já foi encerrada.");
      await ctx.audit.record(tx, {
        action: "room.close_ghost",
        resourceType: "room",
        resourceId: ghost.id,
        metadata: { codigo: ghost.code, pessoas: ghost.people },
      });
      return ghost;
    });
    return { code: closed.code };
  },
);
