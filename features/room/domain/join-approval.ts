import type { TokenDecision, TokenDeps } from "./issue-token";
import { managesRoomAccess } from "./room-access";
import type { RoomRole } from "./room-role";

/** Someone who must be let in: an account or a guest, with the name the owner will see. */
export interface ApprovalRequest {
  room: string;
  requester: { userId: string } | { guestId: string };
  name: string;
  requestId: string | undefined;
}

export type ApprovalResult =
  | { approved: true }
  | { approved: false; requestId: string }
  /** Too many people asking at once: no new request now. */
  | { approved: false; queueFull: true };

const QUEUE_FULL_MESSAGE = "Muita gente pedindo para entrar agora. Tente de novo em instantes.";

const AWAITING_MESSAGE = "Pedido enviado. Aguarde quem cuida da sala aceitar.";

/** Entry with approval: everyone but the owner and moderators asks first (once accepted, in). */
export async function checkApproval(
  request: ApprovalRequest,
  role: RoomRole,
  deps: Pick<TokenDeps, "accessOf" | "awaitApproval">,
): Promise<TokenDecision | undefined> {
  if (managesRoomAccess(role)) return undefined;
  if ((await deps.accessOf(request.room)) === "open") return undefined;
  const approval = await deps.awaitApproval(request);
  if (approval.approved) return undefined;
  if ("queueFull" in approval) {
    return {
      ok: false,
      error: "rate_limited",
      log: "rate_limited",
      message: QUEUE_FULL_MESSAGE,
      retryAfterSeconds: 30,
    };
  }
  return {
    ok: false,
    error: "awaiting_approval",
    log: "awaiting_approval",
    message: AWAITING_MESSAGE,
    requestId: approval.requestId,
  };
}
