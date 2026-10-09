import { z } from "zod";
import { readJson } from "@/lib/read-json";
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
  | { ok: false; code: TokenErrorCode | "network_error"; message: string };

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
  if (error.success) return { ok: false, code: error.data.error, message: error.data.message };
  return {
    ok: false,
    code: "server_error",
    message: "Não foi possível concluir sua entrada. Aguarde alguns segundos e tente de novo.",
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

const renameReplySchema = z.object({ name: z.string().optional(), message: z.string().optional() });

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
    const json = renameReplySchema.safeParse(await response.json().catch(() => null));
    const reply = json.success ? json.data : {};
    if (response.ok) return { ok: true, name: reply.name ?? name };
    return { ok: false, message: reply.message ?? fallback };
  } catch {
    return { ok: false, message: fallback };
  }
}
