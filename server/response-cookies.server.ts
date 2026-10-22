import { AsyncLocalStorage } from "node:async_hooks";

const cookies = new AsyncLocalStorage<Map<string, string>>();

function cookieName(value: string): string {
  return value.slice(0, value.indexOf("="));
}

/**
 * Adds the collected session refreshes to a response, except for a cookie the response sets
 * itself: an auth route may have signed out or replaced the session after it was read.
 */
export function appendSessionCookies(response: Response, collected: Iterable<string>): void {
  const explicit = new Set(response.headers.getSetCookie().map(cookieName));
  for (const value of collected) {
    if (explicit.has(cookieName(value))) continue;
    response.headers.append("Set-Cookie", value);
  }
}

/**
 * Runs `run` collecting the session refreshes it causes, for code that reads a session
 * before React Router builds the response (the Hono layer). Pass them to
 * `appendSessionCookies` once the response exists, or the browser keeps the old cookie.
 */
export function collectSessionCookies<T>(
  run: () => Promise<T>,
): Promise<{ result: T; cookies: string[] }> {
  return cookies.run(new Map(), async () => {
    const result = await run();
    return { result, cookies: [...(cookies.getStore()?.values() ?? [])] };
  });
}

/** Collects session refreshes from parallel loaders and applies them to this response only. */
export async function withResponseCookies(next: () => Promise<Response>): Promise<Response> {
  const { result: response, cookies: collected } = await collectSessionCookies(next);
  appendSessionCookies(response, collected);
  return response;
}

/** Better Auth's server API returns cookies separately from the session data. */
export async function sessionWithCookies<T>(
  pending: Promise<{ response: T; headers: Headers }>,
): Promise<T> {
  const { response, headers } = await pending;
  const current = cookies.getStore();
  if (!current) return response;
  for (const value of headers.getSetCookie()) current.set(cookieName(value), value);
  return response;
}
