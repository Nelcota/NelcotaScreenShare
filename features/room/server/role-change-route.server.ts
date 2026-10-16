import { roleChangeRequestSchema, type RoleChange } from "@/features/room/domain/role-change";
import { readJsonBody, SMALL_JSON_MAX_BYTES } from "@/server/body.server";
import { getDb } from "@/server/db/index.server";
import { forbiddenCrossSite, isCrossSiteMutation } from "@/server/origin-guard.server";
import { createRateLimiter } from "@/server/rate-limit.server";
import { requestLogger } from "@/server/request-log.server";
import { recordCallAudit } from "./call-audit.server";
import { liveKitGateway, type LiveKitGateway } from "./livekit-gateway.server";
import { roomCaller } from "./room-caller.server";
import { applyRoleChange, type ChangedRole, type RoleChangeResult } from "./role-changes.server";
import { mediaRoomForCode } from "./session-store.server";

const limiter = createRateLimiter({ limit: 30, windowMs: 60_000 });

type Refusal = Extract<RoleChangeResult, { ok: false }>["error"];

const REFUSALS: Record<Refusal, { status: number; message: string }> = {
  not_owner: { status: 403, message: "Só quem é dono da sala muda os papéis." },
  self: { status: 400, message: "Escolha outra pessoa." },
  already: { status: 409, message: "Essa pessoa já é moderadora." },
  not_moderator: { status: 409, message: "Essa pessoa não é moderadora." },
  no_account: { status: 409, message: "Só quem tem conta pode ter um papel na sala." },
  permanent: { status: 409, message: "Uma sala permanente continua com quem a criou." },
};

const AUDIT_ACTIONS: Record<RoleChange, string> = {
  promote: "room.moderator_grant",
  demote: "room.moderator_revoke",
  transfer: "room.owner_transfer",
};

function fail(message: string, status: number) {
  return Response.json({ message }, { status });
}

/** Shows the new roles to whoever is in the call; someone outside sees it when they join. */
async function showInCall(
  gateway: Pick<LiveKitGateway, "updateRole">,
  room: string,
  changed: ChangedRole[],
) {
  const mediaRoom = await mediaRoomForCode(room);
  await Promise.all(changed.map(({ userId, role }) => gateway.updateRole(mediaRoom, userId, role)));
}

/** POST /api/sala/papel: the owner makes or unmakes moderators, or hands the room over. */
export async function changeRoomRole(
  request: Request,
  gateway: Pick<LiveKitGateway, "updateRole"> = liveKitGateway,
) {
  if (isCrossSiteMutation(request)) return forbiddenCrossSite();
  const caller = await roomCaller(request);
  if (caller?.kind !== "account") return fail("Entre na sua conta para mudar os papéis.", 401);
  if (!limiter.hit(caller.identity).ok) return fail("Muitas tentativas. Aguarde um pouco.", 429);

  const parsed = roleChangeRequestSchema.safeParse(
    await readJsonBody(request, SMALL_JSON_MAX_BYTES),
  );
  if (!parsed.success) return fail("Pedido inválido.", 400);
  const { room, userId, change } = parsed.data;

  const log = requestLogger({ route: "api/sala/papel" });
  try {
    const db = getDb();
    const result = await applyRoleChange(db, {
      roomCode: room,
      actorUserId: caller.identity,
      targetUserId: userId,
      change,
    });
    if (!result.ok) return fail(REFUSALS[result.error].message, REFUSALS[result.error].status);
    await recordCallAudit(db, {
      userId: caller.identity,
      action: AUDIT_ACTIONS[change],
      room,
      target: userId,
    });
    await showInCall(gateway, room, result.changed);
    return Response.json({ changed: result.changed });
  } catch (error) {
    log.error({ err: error }, "failed to change a room role");
    return fail("Não foi possível agora. Tente de novo.", 502);
  }
}
