import { randomBytes } from "node:crypto";
import type { MiddlewareFunction } from "react-router";
import { buildCsp } from "./csp.server";
import { CLIENT_IP_HEADER, getClientIp } from "./client-ip.server";
import { getEnv } from "./env.server";
import { withResponseCookies } from "./response-cookies.server";

const REQUEST_ID = /^[A-Za-z0-9._-]{8,64}$/;

export const requestMiddleware: MiddlewareFunction<Response> = async ({ request }, next) => {
  const env = getEnv();
  const incoming = request.headers.get("x-request-id");
  const requestId = incoming && REQUEST_ID.test(incoming) ? incoming : crypto.randomUUID();
  request.headers.set("x-request-id", requestId);
  request.headers.set(CLIENT_IP_HEADER, getClientIp(request.headers, env.TRUSTED_PROXY_HOPS));
  const nonce = randomBytes(24).toString("base64");
  request.headers.set("x-nonce", nonce);
  const response = await withResponseCookies(next);
  response.headers.set("x-request-id", requestId);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(self), display-capture=(self), geolocation=()",
  );
  if (response.headers.get("Content-Type")?.includes("text/html")) {
    response.headers.set(
      "Content-Security-Policy",
      buildCsp({
        livekitUrl: env.LIVEKIT_URL,
        nonce,
        dev: process.env.NODE_ENV !== "production",
        sentryDsn: env.PUBLIC_SENTRY_DSN,
        devWebSocketOrigin: new URL(request.url).origin.replace(/^http/, "ws"),
      }),
    );
  }
  return response;
};
