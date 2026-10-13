import { and, eq, isNull } from "drizzle-orm";
import { recordAudit } from "@/server/audit.server";
import type { DbExecutor } from "@/server/db/index.server";
import { rooms } from "@/server/db/schema";

/**
 * Audit row for something an account did to another person from inside a call, with the
 * same resource as the admin panel's actions so the room's history shows both.
 */
export async function recordCallAudit(
  db: DbExecutor,
  {
    userId,
    action,
    room,
    target,
  }: { userId: string; action: string; room: string; target: string },
): Promise<void> {
  // The room row exists once the webhook projected the call; without it, the code identifies it.
  const [projected] = await db
    .select({ id: rooms.id })
    .from(rooms)
    .where(and(eq(rooms.code, room), isNull(rooms.deletedAt)));
  await recordAudit(
    db,
    { userId },
    {
      action,
      resourceType: "room",
      resourceId: projected?.id ?? null,
      metadata: { sala: room, participante: target, origem: "chamada" },
    },
  );
}
