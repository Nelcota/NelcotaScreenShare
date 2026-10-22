import { randomBytes } from "node:crypto";
import { attachmentStorageOrigin } from "@/server/storage/attachment-storage.server";
import type { MiddlewareFunction } from "react-router";
import { buildCsp } from "./csp.server";
import { CLIENT_IP_HEADER, getClientIp } from "./client-ip.server";
import { appUrl, getEnv } from "./env.server";
import { withResponseCookies } from "./response-cookies.server";

const REQUEST_ID = /^[A-Za-z0-9._-]{8,64}$/;

export const requestMiddleware: MiddlewareFunction<Response> = async ({ request }, next) => {
  const env = getEnv();
  // The request's id is always the server's: a client could replay another request's id
  // and blur the audit. One sent from outside is kept apart, to match the proxy's logs.
  const incoming = request.headers.get("x-request-id");
  const requestId = crypto.randomUUID();
  request.headers.set("x-request-id", requestId);
  request.headers.delete("x-upstream-request-id");
  if (incoming && REQUEST_ID.test(incoming)) request.headers.set("x-upstream-request-id", incoming);
  request.headers.set(CLIENT_IP_HEADER, getClientIp(request.headers, env.TRUSTED_PROXY_HOPS));
  const nonce = randomBytes(24).toString("base64");
  request.headers.set("x-nonce", nonce);
  const response = await withResponseCookies(next);
  response.headers.set("x-request-id", requestId);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set(
    "Referrer-Policy",
    new URL(request.url).pathname.startsWith("/times/convite/")
      ? "no-referrer"
      : "strict-origin-when-cross-origin",
  );
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set(
    "Permissions-Policy",
    "camera=(self), microphone=(self), display-capture=(self), geolocation=()",
  );
  // Served over HTTPS only (production): browsers stop trying plain HTTP for a year.
  if (appUrl().startsWith("https://"))
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  if (response.headers.get("Content-Type")?.includes("text/html")) {
    // Pages carry the person's name, e-mail and sessions: never kept by a shared cache, and
    // not shown again by the Back button after signing out.
    if (!response.headers.has("Cache-Control"))
      response.headers.set("Cache-Control", "private, no-store");
    response.headers.set(
      "Content-Security-Policy",
      buildCsp({
        livekitUrl: env.ROOM_HOST_CONTROLS_ENABLED
          ? appUrl().replace(/^http/, "ws")
          : env.LIVEKIT_URL,
        nonce,
        dev: process.env.NODE_ENV !== "production",
        sentryDsn: env.PUBLIC_SENTRY_DSN,
        gifs: env.KLIPY_API_KEY !== undefined,
        fileStorageOrigin: attachmentStorageOrigin(),
        devWebSocketOrigin: new URL(request.url).origin.replace(/^http/, "ws"),
      }),
    );
  }
  return response;
};
