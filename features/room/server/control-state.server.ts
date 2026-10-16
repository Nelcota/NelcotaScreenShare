import { canHostDefinition } from "@/features/rooms/server/room-access.server";
import { createRateLimiter } from "@/server/rate-limit.server";
import { and, eq, ne } from "drizzle-orm";
import type { Database } from "@/server/db/index.server";
import { getDb } from "@/server/db/index.server";
import { getEnv } from "@/server/env.server";
import { roomCommands, roomSessions } from "@/server/db/schema/room-control";
import { mayShareScreen, roomControlInputSchema } from "@/features/room/domain/host-controls";
import { roomCaller } from "./room-caller.server";
import { lockControlRoom, memberInSession, sessionByMediaName } from "./session-store.server";
import { controlGateway } from "./control-gateway.server";
import { reconcileSessionPresence } from "./session-presence.server";
import { roomRoleOf } from "./room-roles.server";
import { closeEndsRoom, hostCommandsFor } from "@/features/room/domain/room-host";
import { roomRoles } from "@/server/db/schema";

export async function readControlState(
  db: Database,
  room: string,
  sessionId: string,
  identity: string,
) {
  return db.transaction(async (tx) => {
    await lockControlRoom(tx, room);
    const [initial] = await tx.select().from(roomSessions).where(eq(roomSessions.id, sessionId));
    if (!initial) return undefined;
    const definition = await sessionByMediaName(tx, initial.mediaRoomName);
    if (definition?.code !== room) return undefined;
    const member = await memberInSession(tx, sessionId, identity);
    if (!member?.admittedAt) return undefined;
    const session = await reconcileSessionPresence(
      tx,
      initial,
      await controlGateway.participants(initial.mediaRoomName),
      new Date(),
    );
    const commands = await tx
      .select({ status: roomCommands.status })
      .from(roomCommands)
      .where(and(eq(roomCommands.sessionId, session.id), ne(roomCommands.status, "applied")));
    const mayHost =
      !member.excludedAt && (await canHostDefinition(tx, definition.definition, identity));
    const isHost = session.hostUserId === identity && mayHost;
    const role = mayHost
      ? await roomRoleOf(tx, { roomCode: room, userId: identity })
      : "participant";
    const [owner] = await tx
      .select({ userId: roomRoles.userId })
      .from(roomRoles)
      .where(and(eq(roomRoles.roomCode, room), eq(roomRoles.role, "owner")))
      .limit(1);
    return {
      sessionId,
      permanent: definition.definition.kind !== "ad_hoc",
      hostIdentity: session.hostUserId,
      isHost,
      commands: [...hostCommandsFor({ isHost, role })],
      endsRoom: closeEndsRoom({ kind: definition.definition.kind, hasOwner: owner !== undefined }),
      locked: session.admissionLocked,
      policy: session.sharePolicy,
      allowed: session.allowedSharers,
      canShare:
        !member.excludedAt &&
        session.status !== "closed" &&
        mayShareScreen(identity, session.hostUserId, session.sharePolicy, session.allowedSharers),
      closed: session.status === "closed",
      removed: Boolean(member.excludedAt),
      pending: commands.some((command) => command.status === "pending"),
      failed: commands.some((command) => command.status === "failed"),
    };
  });
}

/** Each read takes the room's lock: three times what the call polls (every 2 s). */
const readLimiter = createRateLimiter({ limit: 120, windowMs: 60_000 });

export async function requestControlState(request: Request) {
  if (!getEnv().ROOM_HOST_CONTROLS_ENABLED) return new Response(null, { status: 404 });
  const input = roomControlInputSchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!input.success) return new Response(null, { status: 400 });
  const caller = await roomCaller(request);
  if (!caller) return new Response(null, { status: 401 });
  if (!readLimiter.hit(caller.identity).ok) return new Response(null, { status: 429 });
  const state = await readControlState(
    getDb(),
    input.data.room,
    input.data.sessionId,
    caller.identity,
  );
  if (!state) return new Response(null, { status: 403 });
  return Response.json(state, { headers: { "Cache-Control": "no-store" } });
}
