import { requestHeaders } from "@/server/request-context.server";
import type { Logger } from "pino";
import { logger } from "@/server/logger.server";

/** A header set in the middleware (or `undefined` outside a request). */
function currentHeader(name: string): string | undefined {
  try {
    return requestHeaders().get(name) ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Logger with the current request's `request_id`, to tie together logs, errors and audit,
 * and the id the proxy sent, if any, to match its own logs.
 */
export function requestLogger(bindings: Record<string, unknown> = {}): Logger {
  const requestId = currentHeader("x-request-id");
  const upstream = currentHeader("x-upstream-request-id");
  return logger.child({
    ...(requestId ? { request_id: requestId } : {}),
    ...(upstream ? { upstream_request_id: upstream } : {}),
    ...bindings,
  });
}
