import { z } from "zod";
import { roomCodeSchema, roomPath } from "@/features/room/domain/room-code";
import { managesRoomAccess, roomAccessSchema } from "@/features/room/domain/room-access";
import { defineUserOperation } from "@/features/auth/server/operation-policies.server";
import { getDb, type DbExecutor } from "@/server/db/index.server";
import { getEnv } from "@/server/env.server";
import { ActionError } from "@/server/operations/action-error";
import { createRateLimiter } from "@/server/rate-limit.server";
import { roomAccessOf, saveRoomAccess } from "./server/room-access.server";
import { answerJoinRequest, pendingJoinRequests } from "./server/join-requests.server";
import { createRoom, roomExists } from "./server/room-codes.server";
import { roomRoleOf } from "./server/room-roles.server";
import { hostCommandSchema } from "./domain/host-controls";
import { executeHostCommand } from "./server/host-command.server";

/** Rooms per account: plenty for real use, too few to fill the table with codes. */
const roomsPerAccount = createRateLimiter({ limit: 10, windowMs: 10 * 60_000 });

/** "Criar sala": the account that creates the room is its owner. */
export const createRoomAction = defineUserOperation(
  { name: "room.create", audit: "none" },
  z.undefined(),
  async ({ ctx }) => {
    const userId = ctx.current.user.id;
    if (getEnv().REQUIRE_EMAIL_VERIFICATION && !ctx.current.user.emailVerified) {
      throw new ActionError(
        "Confirme seu e-mail para criar salas. O link está na sua caixa de entrada.",
      );
    }
    if (!roomsPerAccount.hit(userId).ok) {
      throw new ActionError("Você criou muitas salas agora. Aguarde alguns minutos.");
    }
    const code = await createRoom(getDb(), userId);
    return { path: roomPath(code) };
  },
);

const roomSchema = z.object({ room: roomCodeSchema });

/** The room's access mode, and whether the caller may change it (owner or moderator). */
export const roomAccess = defineUserOperation(
  { name: "room.access", audit: "none" },
  roomSchema,
  async ({ parsedInput, ctx }) => {
    const db = getDb();
    const role = await roomRoleOf(db, { roomCode: parsedInput.room, userId: ctx.current.user.id });
    return {
      access: await roomAccessOf(db, parsedInput.room),
      canManage: managesRoomAccess(role),
    };
  },
);

/** Open entry or entry with approval; only the owner and moderators choose. */
export const setRoomAccess = defineUserOperation(
  { name: "room.setAccess", audit: "required" },
  z.object({ room: roomCodeSchema, access: roomAccessSchema }),
  async ({ parsedInput, ctx }) => {
    const userId = ctx.current.user.id;
    const { room, access } = parsedInput;
    return getDb().transaction(async (tx) => {
      if (!(await roomExists(tx, room))) throw new ActionError("Esta sala não existe.");
      const role = await roomRoleOf(tx, { roomCode: room, userId });
      if (!managesRoomAccess(role)) {
        throw new ActionError("Só o dono e os moderadores mudam a entrada da sala.");
      }
      await saveRoomAccess(tx, { roomCode: room, access, userId });
      await ctx.audit.record(tx, {
        action: "room.access_update",
        resourceType: "room",
        resourceId: room,
        metadata: { access },
      });
      return { access };
    });
  },
);

async function requireManager(db: DbExecutor, room: string, userId: string) {
  const role = await roomRoleOf(db, { roomCode: room, userId });
  if (!managesRoomAccess(role)) {
    throw new ActionError("Só o dono e os moderadores respondem aos pedidos.");
  }
}

/** People waiting to enter, for the owner and moderators. */
export const joinRequests = defineUserOperation(
  { name: "room.joinRequests", audit: "none" },
  roomSchema,
  async ({ parsedInput, ctx }) => {
    const db = getDb();
    await requireManager(db, parsedInput.room, ctx.current.user.id);
    return { requests: await pendingJoinRequests(db, parsedInput.room) };
  },
);

/** Lets someone in or not; the person waiting sees the answer on their screen. */
export const answerJoin = defineUserOperation(
  { name: "room.answerJoin", audit: "required" },
  z.object({ room: roomCodeSchema, requestId: z.uuid(), accept: z.boolean() }),
  async ({ parsedInput, ctx }) => {
    const userId = ctx.current.user.id;
    const { room, requestId, accept } = parsedInput;
    return getDb().transaction(async (tx) => {
      await requireManager(tx, room, userId);
      const answered = await answerJoinRequest(tx, {
        roomCode: room,
        requestId,
        deciderId: userId,
        accept,
      });
      if (!answered) throw new ActionError("Esse pedido já foi respondido ou expirou.");
      await ctx.audit.record(tx, {
        action: "room.join_answer",
        resourceType: "room",
        resourceId: room,
        metadata: { requestId, accept },
      });
      return { accepted: accept };
    });
  },
);

const limiter = createRateLimiter({ limit: 20, windowMs: 60_000 });

export const hostCommandAction = defineUserOperation(
  { name: "room.hostCommand", audit: "required" },
  hostCommandSchema,
  async ({ parsedInput, ctx }) => {
    if (!getEnv().ROOM_HOST_CONTROLS_ENABLED)
      throw new ActionError("Os controles do anfitrião ainda não estão disponíveis.");
    if (!limiter.hit(ctx.current.user.id).ok)
      throw new ActionError("Muitas alterações seguidas. Aguarde um pouco.");
    return executeHostCommand(getDb(), ctx.current.user.id, parsedInput, ctx.audit);
  },
);
