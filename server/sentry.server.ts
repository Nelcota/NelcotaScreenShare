import { redactTelemetryUrls } from "@/lib/telemetry-urls";
import type { NodeOptions } from "@sentry/react-router";
import { getEnv } from "@/server/env.server";

/**
 * Server-side Sentry, without personal data (LGPD): no user, IP, cookies,
 * auth headers, query string or request body. `traceLifecycle: "static"` keeps the
 * traces compatible with GlitchTip, should we ever switch.
 */
export function sentryOptions(dsn: string): NodeOptions {
  return {
    dsn,
    environment: process.env.NODE_ENV,
    release: getEnv().APP_VERSION,
    // SDK 11: the default collects user, cookies, headers and bodies. Here, only the minimum.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: {
        request: { allow: ["user-agent", "content-type", "x-request-id"] },
        response: false,
      },
      httpBodies: [],
      urlQueryParams: false,
    },
    tracesSampleRate: 0.1,
    traceLifecycle: "static",
    beforeSendTransaction: redactTelemetryUrls,
    beforeSend(event) {
      if (event.user) event.user = event.user.id ? { id: event.user.id } : undefined;
      if (event.request) {
        delete event.request.cookies;
        delete event.request.data;
        if (event.request.headers) {
          for (const name of ["cookie", "authorization", "x-forwarded-for", "x-real-ip"]) {
            delete event.request.headers[name];
          }
        }
      }
      return redactTelemetryUrls(event);
    },
  };
}
