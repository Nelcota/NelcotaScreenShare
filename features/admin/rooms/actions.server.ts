import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { BULK_FILTER_LIMIT } from "@/lib/table-params";
import { roomLink } from "@/features/room/domain/room-code";
import { defineAdminOperation } from "@/features/auth/server/operation-policies.server";
import { ActionError } from "@/server/operations/action-error";
import { diffChanges } from "@/server/audit.server";
import { getDb } from "@/server/db/index.server";
import { roomParticipations, rooms } from "@/server/db/schema";
import { appUrl } from "@/server/env.server";
import { createRoomInvite, revokeRoomInvite } from "@/features/room/server/invites.server";
import { lockRoomCodes } from "@/features/room/server/room-lifecycle.server";
import { liveKitGateway } from "@/features/room/server/livekit-gateway.server";
import { readmitToSession } from "@/features/room/server/call-removals.server";
import { removeFromCall } from "@/features/room/server/moderation.server";
import { bulkChange, bulkSelectionSchema, resolveSelection } from "@/server/table/selection.server";
import { INVITE_VALIDITY, inviteMaxUsesSchema } from "./domain/invites";
import { roomIdsForFilter } from "./server/queries.server";

/** Reversible deletion. A live room cannot be deleted: end it first. */
export const deleteRoomsAction = defineAdminOperation(
  { name: "room.delete", permission: { room: ["delete"] }, audit: "required" },
  z.object({ selection: bulkSelectionSchema }),
  async ({ parsedInput, ctx }) => {
    const db = getDb();
    const ids = await resolveSelection(parsedInput.selection, (search, limit) =>
      roomIdsForFilter(db, search, limit),
    );
    const changed = await bulkChange(
      ctx.audit,
      async (tx) => {
        const selected = await tx
          .select({ code: rooms.code })
          .from(rooms)
          .where(inArray(rooms.id, ids));
        await lockRoomCodes(
          tx,
          selected.map((room) => room.code),
        );
        const live = await tx
          .select({ code: rooms.code })
          .from(rooms)
          .where(and(inArray(rooms.id, ids), eq(rooms.status, "active"), isNull(rooms.deletedAt)));
        if (live.length > 0) {
          throw new ActionError(
            live.length === 1
              ? `A sala ${live[0]?.code} está ao vivo. Encerre a sala antes de excluir.`
              : `${live.length} salas estão ao vivo. Encerre as salas antes de excluir.`,
          );
        }
        return tx
          .update(rooms)
          .set({ deletedAt: sql`now()` })
          .where(and(inArray(rooms.id, ids), isNull(rooms.deletedAt)))
          .returning({ id: rooms.id, code: rooms.code });
      },
      {
        empty: "Nenhuma sala para excluir na seleção.",
        entry: (room) => ({
          action: "room.delete",
          resourceType: "room",
          resourceId: room.id,
          metadata: { codigo: room.code },
        }),
      },
    );
    return { ids: changed.map((room) => room.id) };
  },
);

/**
 * Undoes the deletion. If the same code is already in use again (a new room
 * created later), that room stays deleted: only one live room per code.
 */
export const restoreRoomsAction = defineAdminOperation(
  { name: "room.restore", permission: { room: ["delete"] }, audit: "required" },
  z.object({ ids: z.array(z.uuid()).min(1).max(BULK_FILTER_LIMIT) }),
  async ({ parsedInput, ctx }) => {
    const changed = await bulkChange(
      ctx.audit,
      async (tx) => {
        const candidates = alias(rooms, "candidates");
        // Multiple deleted generations can share a code. Restore only the newest selected one.
        const restorable = tx
          .selectDistinctOn([candidates.code], { id: candidates.id })
          .from(candidates)
          .where(
            and(
              inArray(candidates.id, parsedInput.ids),
              isNotNull(candidates.deletedAt),
              sql`not exists (select 1 from rooms as live
                where live.code = ${candidates.code} and live.deleted_at is null)`,
            ),
          )
          .orderBy(asc(candidates.code), desc(candidates.deletedAt), asc(candidates.id));
        return tx
          .update(rooms)
          .set({ deletedAt: null })
          .where(inArray(rooms.id, restorable))
          .returning({ id: rooms.id });
      },
      {
        empty: "Nada para restaurar. O código pode já estar em uso por outra sala.",
        entry: (room) => ({ action: "room.restore", resourceType: "room", resourceId: room.id }),
      },
    );
    return { count: changed.length };
  },
);

/** Internal room note (only the admin panel sees it). */
export const updateRoomNoteAction = defineAdminOperation(
  { name: "room.updateNote", permission: { room: ["update"] }, audit: "required" },
  z.object({
    id: z.uuid(),
    note: z.string().trim().max(500, "A nota pode ter até 500 caracteres."),
  }),
  async ({ parsedInput, ctx }) => {
    const db = getDb();
    const note = parsedInput.note || null;
    await db.transaction(async (tx) => {
      const [before] = await tx
        .select({ note: rooms.note })
        .from(rooms)
        .where(eq(rooms.id, parsedInput.id))
        .for("update");
      if (!before) throw new ActionError("Sala não encontrada.");
      const changes = diffChanges(before, { note });
      if (!changes) throw new ActionError("A nota não mudou.");
      await tx.update(rooms).set({ note }).where(eq(rooms.id, parsedInput.id));
      await ctx.audit.record(tx, {
        action: "room.update",
        resourceType: "room",
        resourceId: parsedInput.id,
        changes,
      });
    });
    return { saved: true };
  },
);

/** Invite with an expiry and/or a people limit. The link is only shown now. */
export const createInviteAction = defineAdminOperation(
  {
    name: "roomInvite.create",
    permission: { roomInvite: ["create"] },
    audit: "required",
  },
  z.object({
    roomId: z.uuid(),
    label: z.string().trim().max(80, "O nome pode ter até 80 caracteres."),
    maxUses: inviteMaxUsesSchema,
    validityHours: z
      .number()
      .refine((hours) => INVITE_VALIDITY.some((option) => option.hours === hours))
      .nullable(),
  }),
  async ({ parsedInput, ctx }) => {
    const db = getDb();
    const result = await db.transaction(async (tx) => {
      const [room] = await tx
        .select({ code: rooms.code })
        .from(rooms)
        .where(and(eq(rooms.id, parsedInput.roomId), isNull(rooms.deletedAt)));
      if (!room) throw new ActionError("Sala não encontrada.");
      const expiresAt = parsedInput.validityHours
        ? new Date(Date.now() + parsedInput.validityHours * 3_600_000)
        : null;
      const invite = await createRoomInvite(tx, {
        roomId: parsedInput.roomId,
        label: parsedInput.label || null,
        maxUses: parsedInput.maxUses,
        expiresAt,
        createdBy: ctx.admin.user.id,
      });
      await ctx.audit.record(tx, {
        action: "room_invite.create",
        resourceType: "room_invite",
        resourceId: invite.id,
        metadata: {
          sala: parsedInput.roomId,
          limite: parsedInput.maxUses,
          expira: expiresAt?.toISOString() ?? null,
        },
      });
      return { code: room.code, token: invite.token };
    });
    return { link: `${appUrl()}${roomLink(result.code, result.token)}` };
  },
);

export const revokeInviteAction = defineAdminOperation(
  {
    name: "roomInvite.revoke",
    permission: { roomInvite: ["revoke"] },
    audit: "required",
  },
  z.object({ id: z.uuid() }),
  async ({ parsedInput, ctx }) => {
    const db = getDb();
    await db.transaction(async (tx) => {
      const revoked = await revokeRoomInvite(tx, parsedInput.id);
      if (!revoked) throw new ActionError("Esse convite já foi revogado.");
      await ctx.audit.record(tx, {
        action: "room_invite.revoke",
        resourceType: "room_invite",
        resourceId: revoked.id,
        metadata: { sala: revoked.roomId },
      });
      return revoked;
    });
    return { revoked: true };
  },
);

/**
 * Kick (they may join again) or ban (refused until this call ends) someone who is in the
 * room now. The panel needs no room role: any admin with `live.kick` removes anyone.
 */
export const removeParticipantAction = defineAdminOperation(
  { name: "room.removeParticipant", permission: { live: ["kick"] }, audit: "required" },
  z.object({ participationId: z.uuid(), action: z.enum(["kick", "ban"]) }),
  async ({ parsedInput, ctx }) => {
    const db = getDb();
    const [participation] = await db
      .select({
        roomId: rooms.id,
        code: rooms.code,
        identity: roomParticipations.livekitIdentity,
      })
      .from(roomParticipations)
      .innerJoin(rooms, eq(rooms.id, roomParticipations.roomId))
      .where(
        and(
          eq(roomParticipations.id, parsedInput.participationId),
          isNull(roomParticipations.leftAt),
        ),
      );
    if (!participation) throw new ActionError("Essa pessoa já saiu da sala.");

    // The audit row and the ban are written before LiveKit is called, in one transaction: a
    // failed removal rolls both back, and a removal is never left without its record.
    await db.transaction(async (tx) => {
      await ctx.audit.record(tx, {
        action: parsedInput.action === "ban" ? "room.participant_ban" : "room.participant_kick",
        resourceType: "room",
        resourceId: participation.roomId,
        metadata: { participacao: parsedInput.participationId },
      });
      const result = await removeFromCall(
        tx,
        liveKitGateway,
        { room: participation.code, identity: participation.identity, action: parsedInput.action },
        { adminId: ctx.admin.user.id },
      );
      if (!result.ok) throw new ActionError(result.message);
    });
    return { removed: true };
  },
);

const READMIT_REFUSALS: Record<"not_removed" | "no_call", string> = {
  not_removed: "Essa pessoa já pode voltar.",
  no_call: "A chamada já acabou.",
};

/**
 * "Deixar voltar": lifts a ban from the call happening now, so the person may join again.
 * Same permission as banning. Nothing records who lifted it but this audit row.
 */
export const readmitParticipantAction = defineAdminOperation(
  { name: "room.readmitParticipant", permission: { live: ["kick"] }, audit: "required" },
  z.object({ roomId: z.uuid(), identity: z.string().min(1).max(128) }),
  async ({ parsedInput, ctx }) => {
    const db = getDb();
    const [room] = await db
      .select({ id: rooms.id, code: rooms.code })
      .from(rooms)
      .where(and(eq(rooms.id, parsedInput.roomId), isNull(rooms.deletedAt)));
    if (!room) throw new ActionError("Sala não encontrada.");

    await db.transaction(async (tx) => {
      const result = await readmitToSession(tx, {
        roomCode: room.code,
        identity: parsedInput.identity,
      });
      if (!result.ok) throw new ActionError(READMIT_REFUSALS[result.reason]);
      await ctx.audit.record(tx, {
        action: "room.participant_unban",
        resourceType: "room",
        resourceId: room.id,
        metadata: { pessoa: parsedInput.identity },
      });
    });
    return { readmitted: true };
  },
);
