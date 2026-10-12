import { redactTelemetryUrls } from "./telemetry-urls";
import { isRouteErrorResponse } from "react-router";
import type * as Sentry from "@sentry/react-router";

let sdk: Promise<typeof Sentry | undefined> | undefined;
const pending: unknown[] = [];

/** The SDK is only downloaded when a public DSN is configured. */
export function configureBrowserTelemetry(config?: { dsn?: string; release?: string }) {
  if (!config?.dsn || sdk) return;
  sdk = loadSdk(config.dsn, config.release);
}

async function loadSdk(dsn: string, release?: string): Promise<typeof Sentry | undefined> {
  try {
    const sentry = await import("@sentry/react-router");
    sentry.init({
      dsn,
      release,
      environment: import.meta.env.MODE,
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpHeaders: false,
        httpBodies: [],
        urlQueryParams: false,
      },
      beforeSendTransaction: redactTelemetryUrls,
      // Local browser errors; server errors are already recorded in entry.server.
      beforeSend(event) {
        event.user = undefined;
        if (event.request) {
          event.request.cookies = undefined;
          event.request.data = undefined;
          event.request.headers = undefined;
        }
        return redactTelemetryUrls(event);
      },
    });
    for (const error of pending.splice(0)) sentry.captureException(error);
    return sentry;
  } catch (error) {
    console.error("Could not start observability:", error);
    return undefined;
  }
}

/** `loading` never rejects: a failed SDK download resolves to `undefined`. */
async function captureWhenReady(loading: Promise<typeof Sentry | undefined>, error: unknown) {
  const sentry = await loading;
  sentry?.captureException(error);
}

export function reportBrowserError(error: unknown) {
  if (isRouteErrorResponse(error)) return;
  console.error(error);
  if (sdk) {
    void captureWhenReady(sdk, error);
    return;
  }
  if (pending.length < 10) pending.push(error);
}

/**
 * Expected browser failures (permission denied, offline, best-effort cleanup): logged
 * for debugging, but not sent to telemetry, where they would only be noise.
 */
export function logBrowserWarning(context: string, error: unknown) {
  console.warn(context, error);
}

/**
 * A request that never got an answer: the browser is offline, `fetch` rejected with its
 * network TypeError (Chrome, Firefox and Safari word it differently) or it timed out.
 */
function isNetworkFailure(error: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  if (error instanceof DOMException) {
    return error.name === "AbortError" || error.name === "TimeoutError";
  }
  if (!(error instanceof TypeError)) return false;
  return /failed to fetch|networkerror|load failed|network request failed/i.test(error.message);
}

/** Reports a failure to telemetry, unless it is the expected loss of the network. */
export function reportUnlessNetworkFailure(context: string, error: unknown) {
  if (isNetworkFailure(error)) {
    logBrowserWarning(context, error);
    return;
  }
  reportBrowserError(error);
}

/** Runs a fire-and-forget task: a rejection is reported instead of escaping unhandled. */
export async function runAndReport(task: () => Promise<unknown>): Promise<void> {
  try {
    await task();
  } catch (error) {
    reportBrowserError(error);
  }
}
