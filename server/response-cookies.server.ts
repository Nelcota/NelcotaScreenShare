import { AsyncLocalStorage } from "node:async_hooks";

const cookies = new AsyncLocalStorage<Map<string, string>>();

function cookieName(value: string): string {
  return value.slice(0, value.indexOf("="));
}

/** Collects session refreshes from parallel loaders and applies them to this response only. */
export function withResponseCookies(next: () => Promise<Response>): Promise<Response> {
  return cookies.run(new Map(), async () => {
    const response = await next();
    const explicit = new Set(response.headers.getSetCookie().map(cookieName));
    for (const [name, value] of cookies.getStore() ?? []) {
      // An auth route may have signed out or replaced the session after it was read.
      if (explicit.has(name)) continue;
      response.headers.append("Set-Cookie", value);
    }
    return response;
  });
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
