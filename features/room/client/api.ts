import type { RoleChange } from "@/features/room/domain/role-change";
import { z } from "zod";
import { displayNameSchema } from "@/features/room/domain/participant-label";
import { readJson } from "@/lib/read-json";
import { JOIN_REQUEST_STATUSES, type JoinRequestStatus } from "@/features/room/domain/room-access";
import { logBrowserWarning } from "@/lib/telemetry.client";
import {
  tokenErrorSchema,
  tokenResponseSchema,
  type TokenErrorCode,
  type TokenRequest,
  type TokenResponse,
} from "@/features/room/domain/token-contract";

/** Result of the token request in the browser (not to be confused with the token_requests record). */
export type TokenFetchResult =
  | { ok: true; data: TokenResponse }
  | { ok: false; code: TokenErrorCode | "network_error"; message: string; requestId?: string };

/** The token endpoint's response, or `undefined` when the request never got one (offline). */
async function postTokenRequest(input: TokenRequest): Promise<Response | undefined> {
  try {
    return await fetch("/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      cache: "no-store",
    });
  } catch (error) {
    logBrowserWarning("Token request failed", error);
    return undefined;
  }
}

/** Requests a token from the backend. Runs in the browser; the secret stays on the server. */
export async function requestToken(input: TokenRequest): Promise<TokenFetchResult> {
  const response = await postTokenRequest(input);
  if (!response) {
    return {
      ok: false,
      code: "network_error",
      message: "Não foi possível entrar na sala. Verifique sua internet e tente de novo.",
    };
  }

  const json = await readJson(response);

  if (response.ok) {
    const parsed = tokenResponseSchema.safeParse(json);
    if (parsed.success) return { ok: true, data: parsed.data };
  }

  const error = tokenErrorSchema.safeParse(json);
  if (error.success) {
    const { error: code, message, requestId } = error.data;
    return { ok: false, code, message, ...(requestId === undefined ? {} : { requestId }) };
  }
  return {
    ok: false,
    code: "server_error",
    message: "Não foi possível entrar na sala. Tente de novo em alguns segundos.",
  };
}

/** Raises or lowers the hand (the server writes the attribute; see /api/sala/mao). */
export async function setHandRaised(room: string, raised: boolean): Promise<boolean> {
  try {
    const response = await fetch("/api/sala/mao", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room, raised }),
      cache: "no-store",
    });
    return response.ok;
  } catch (error) {
    logBrowserWarning("Hand request failed", error);
    return false;
  }
}

const renameReplySchema = z.object({
  name: displayNameSchema.optional(),
  message: z.string().optional(),
});

/** Renames oneself in the call (the server checks and writes it; see /api/sala/nome). */
export async function renameInRoom(
  room: string,
  name: string,
): Promise<{ ok: true; name: string } | { ok: false; message: string }> {
  const fallback = "Não foi possível trocar o nome agora. Verifique sua internet e tente de novo.";
  try {
    const response = await fetch("/api/sala/nome", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room, name }),
      cache: "no-store",
    });
    const json = renameReplySchema.safeParse(await readJson(response));
    const reply = json.success ? json.data : {};
    if (response.ok && reply.name !== undefined) return { ok: true, name: reply.name };
    return { ok: false, message: reply.message ?? fallback };
  } catch (error) {
    logBrowserWarning("Room rename request failed", error);
    return { ok: false, message: fallback };
  }
}

const joinStatusSchema = z.object({ status: z.enum(JOIN_REQUEST_STATUSES) });

/** Where my request to enter stands; null when it could not be read (try again later). */
export async function checkJoinRequest(requestId: string): Promise<JoinRequestStatus | null> {
  try {
    const query = new URLSearchParams({ id: requestId });
    const response = await fetch(`/api/sala/pedido?${query.toString()}`, { cache: "no-store" });
    if (response.status === 404) return "expired";
    const parsed = joinStatusSchema.safeParse(await readJson(response));
    return parsed.success ? parsed.data.status : null;
  } catch (error) {
    logBrowserWarning("Join request check failed", error);
    return null;
  }
}

const moderationReplySchema = z.object({ message: z.string().optional() });

/** Removes someone from the call (ban also keeps them out until it ends). */
export async function removeFromCall(
  room: string,
  identity: string,
  action: "kick" | "ban",
): Promise<{ ok: true } | { ok: false; message: string }> {
  const fallback = "Não foi possível tirar a pessoa da sala agora. Tente de novo.";
  try {
    const response = await fetch("/api/sala/moderar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room, identity, action }),
      cache: "no-store",
    });
    if (response.ok) return { ok: true };
    const reply = moderationReplySchema.safeParse(await readJson(response));
    return { ok: false, message: (reply.success && reply.data.message) || fallback };
  } catch (error) {
    logBrowserWarning("Moderation request failed", error);
    return { ok: false, message: fallback };
  }
}

/** The owner makes or unmakes a moderator, or hands the room over (see /api/sala/papel). */
export async function changeRoomRole(
  room: string,
  userId: string,
  change: RoleChange,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const fallback = "Não foi possível mudar o papel agora. Tente de novo.";
  try {
    const response = await fetch("/api/sala/papel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room, userId, change }),
      cache: "no-store",
    });
    if (response.ok) return { ok: true };
    const reply = moderationReplySchema.safeParse(await readJson(response));
    return { ok: false, message: (reply.success && reply.data.message) || fallback };
  } catch (error) {
    logBrowserWarning("Role change request failed", error);
    return { ok: false, message: fallback };
  }
}
