import { z } from "zod";
import { defineUserOperation } from "@/features/auth/server/operation-policies.server";
import { publicProfile } from "@/features/friends/server/friend-list.server";
import { roomCodeSchema, roomLink } from "@/features/room/domain/room-code";
import { answeredCallPath } from "@/features/room/domain/answered-call";
import { admitByRing } from "@/features/ringing/server/ring-admission.server";
import { canRing, mayRingInto } from "@/features/ringing/server/ring-rules.server";
import { connectedCallRoom } from "@/features/ringing/server/ringing-state.server";
import { recordGroupCall, ringableMembers } from "@/features/ringing/server/group-calls.server";
import { membershipOf, memberIdsOf } from "@/features/messages/server/conversations.server";
import { notifyUsers } from "@/features/live/server/live-bus.server";
import {
  acceptRing,
  cancelRing,
  declineRing,
  startRing,
} from "@/features/ringing/server/ring-service.server";
import { getDb } from "@/server/db/index.server";
import { ActionError } from "@/server/operations/action-error";
import { createRateLimiter } from "@/server/rate-limit.server";

const ringSchema = z.object({ ringId: z.uuid() });

/** Enough to call a few friends in a row, too little to harass anyone. */
const ringLimiter = createRateLimiter({ limit: 20, windowMs: 10 * 60_000 });

const UNAVAILABLE = "Não dá para chamar agora.";

/** Rings a friend into the caller's room: the friend gets a card on any page. */
export const callFriend = defineUserOperation(
  { name: "ringing.call", audit: "none" },
  z.object({ friendId: z.uuid(), room: roomCodeSchema.optional() }),
  async ({ parsedInput, ctx }) => {
    const caller = ctx.current.user;
    const db = getDb();
    // Without a room, the call you are in now; none means the page opens a room first.
    const room = parsedInput.room ?? (await connectedCallRoom(db, caller.id));
    if (!room) return { ringId: null, needsRoom: true };
    if (!ringLimiter.hit(caller.id).ok)
      throw new ActionError("Muitas chamadas seguidas. Espere um pouco.");
    if (!(await mayRingInto(db, room, caller.id))) throw new ActionError(UNAVAILABLE);
    if (!(await canRing(db, caller.id, parsedInput.friendId, room))) {
      throw new ActionError(UNAVAILABLE);
    }
    const friend = await publicProfile(db, parsedInput.friendId);
    if (!friend) throw new ActionError(UNAVAILABLE);
    const ring = startRing({
      callerId: caller.id,
      callerName: caller.name,
      calleeId: friend.id,
      calleeName: friend.name,
      roomCode: room,
      conversationId: null,
    });
    return { ringId: ring.id, needsRoom: false };
  },
);

/**
 * "Chamar o grupo": starts the group's call in the caller's room and rings every member who
 * can take a call. The conversation shows it as "Chamada em andamento" while it lasts.
 */
export const callGroup = defineUserOperation(
  { name: "ringing.callGroup", audit: "none" },
  z.object({ conversationId: z.uuid(), room: roomCodeSchema.optional() }),
  async ({ parsedInput, ctx }) => {
    const caller = ctx.current.user;
    const { conversationId } = parsedInput;
    if (!ringLimiter.hit(caller.id).ok)
      throw new ActionError("Muitas chamadas seguidas. Espere um pouco.");
    const db = getDb();
    const membership = await membershipOf(db, conversationId, caller.id);
    if (membership?.kind !== "group") throw new ActionError(UNAVAILABLE);
    const room = parsedInput.room ?? (await connectedCallRoom(db, caller.id));
    if (!room) return { needsRoom: true };
    if (!(await mayRingInto(db, room, caller.id))) throw new ActionError(UNAVAILABLE);
    await recordGroupCall(db, { conversationId, roomCode: room, startedBy: caller.id });
    const ringable = await ringableMembers(db, conversationId, caller.id, room);
    for (const memberId of ringable) {
      const member = await publicProfile(db, memberId);
      if (!member) continue;
      startRing({
        callerId: caller.id,
        callerName: caller.name,
        calleeId: member.id,
        calleeName: member.name,
        roomCode: room,
        conversationId,
      });
    }
    notifyUsers(await memberIdsOf(db, conversationId), "messages");
    // No count of who was rung: it would tell which members are online, friends or not.
    return { needsRoom: false };
  },
);

export const cancelCall = defineUserOperation(
  { name: "ringing.cancel", audit: "none" },
  ringSchema,
  async ({ parsedInput, ctx }) => {
    cancelRing(parsedInput.ringId, ctx.current.user.id);
    return { cancelled: true };
  },
);

/** "Recusar": the card goes away and the caller sees "<Nome> recusou". */
export const declineCall = defineUserOperation(
  { name: "ringing.decline", audit: "none" },
  ringSchema,
  async ({ parsedInput, ctx }) => {
    declineRing(parsedInput.ringId, ctx.current.user.id);
    return { declined: true };
  },
);

/** "Entrar": goes straight into the caller's room. */
export const acceptCall = defineUserOperation(
  { name: "ringing.accept", audit: "required" },
  ringSchema,
  async ({ parsedInput, ctx }) => {
    const callee = ctx.current.user;
    const ring = acceptRing(parsedInput.ringId, callee.id);
    if (!ring) throw new ActionError("A chamada já acabou.");
    return getDb().transaction(async (tx) => {
      const requestId = await admitByRing(tx, ring, callee);
      await ctx.audit.record(tx, {
        action: "room.ring_admit",
        resourceType: "room",
        resourceId: ring.roomCode,
        metadata: { decidedBy: ring.callerId, requestId },
      });
      // Straight into the call: the pre-join only shows if something needs the person.
      return { path: answeredCallPath(roomLink(ring.roomCode)) };
    });
  },
);
