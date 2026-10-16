import { data } from "react-router";
import type { AuthErrorLike } from "@/features/auth/domain/auth-errors";
import { boundAuthBody } from "./auth-body.server";
import { logger } from "@/server/logger.server";

type AuthHandler = (request: Request) => Promise<Response>;

export type AuthFormResult =
  | { ok: true; body: unknown; cookies: string[] }
  | { ok: false; error: AuthErrorLike };

async function jsonBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    logger.warn({ status: response.status }, "auth form: response was not JSON");
    return null;
  }
}

function errorOf(body: unknown, status: number): AuthErrorLike {
  if (!body || typeof body !== "object") return { status };
  const { code, message } = body as { code?: unknown; message?: unknown };
  return {
    status,
    code: typeof code === "string" ? code : undefined,
    message: typeof message === "string" ? message : undefined,
  };
}

/**
 * A form posted without JS (before hydration, or when a script failed to load) goes to the
 * same Better Auth endpoint the page calls with JS, with the browser's own headers: origin
 * check, rate limits, lockout and audit stay exactly the same.
 */
export async function forwardAuthForm(
  request: Request,
  handle: AuthHandler,
  path: string,
  body: Record<string, string>,
): Promise<AuthFormResult> {
  const headers = new Headers(request.headers);
  headers.set("content-type", "application/json");
  headers.delete("content-length");
  const response = await handle(
    new Request(new URL(path, request.url), {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
  );
  const parsed = await jsonBody(response);
  if (!response.ok) return { ok: false, error: errorOf(parsed, response.status) };
  return { ok: true, body: parsed, cookies: response.headers.getSetCookie() };
}

/** Did Better Auth stop at the second factor (sign-in of an account with 2FA)? */
export function asksForSecondFactor(body: unknown): boolean {
  return (
    typeof body === "object" &&
    body !== null &&
    "twoFactorRedirect" in body &&
    body.twoFactorRedirect === true
  );
}

/** Goes on after a native post, carrying the session cookies Better Auth set. */
export function redirectWithCookies(location: string, cookies: string[]): never {
  const headers = new Headers({ Location: location });
  for (const cookie of cookies) headers.append("set-cookie", cookie);
  throw new Response(null, { status: 303, headers });
}

/** Back to the same page with the message under the form. */
export function formFailure(message: string) {
  return data({ error: message }, { status: 400 });
}

/** Bound the original upload before decoding fields, including ignored fields and files. */
export async function readAuthForm(request: Request): Promise<FormData> {
  const bounded = await boundAuthBody(request);
  if (bounded instanceof Response) throw bounded;
  try {
    return await bounded.formData();
  } catch {
    throw new Response("Invalid form body", { status: 400 });
  }
}
