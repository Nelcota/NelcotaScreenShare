import { PassThrough } from "node:stream";
import { createReadableStreamFromReadable } from "@react-router/node";
import { ServerRouter, type EntryContext, type HandleErrorFunction } from "react-router";
import { renderToPipeableStream } from "react-dom/server";
import { initializeRuntime, reportServerError } from "@/features/runtime/server/runtime.server";
export { shutdownRuntime } from "@/features/runtime/server/runtime.server";
import { logger } from "@/server/logger.server";

await initializeRuntime();

export const streamTimeout = 5_000;

export default function handleRequest(
  request: Request,
  status: number,
  headers: Headers,
  context: EntryContext,
) {
  return new Promise<Response>((resolve, reject) => {
    let didError = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const nonce = request.headers.get("x-nonce") ?? undefined;
    const { pipe, abort } = renderToPipeableStream(
      <ServerRouter context={context} url={request.url} nonce={nonce} />,
      {
        nonce,
        onShellReady() {
          const body = new PassThrough();
          headers.set("Content-Type", "text/html; charset=utf-8");
          resolve(
            new Response(createReadableStreamFromReadable(body), {
              status: didError ? 500 : status,
              headers,
            }),
          );
          pipe(body);
        },
        onAllReady() {
          clearTimeout(timer);
        },
        onShellError(error: unknown) {
          clearTimeout(timer);
          reject(error);
        },
        onError(error: unknown) {
          didError = true;
          reportServerError(error, request);
          logger.error(
            { err: error, request_id: request.headers.get("x-request-id") },
            "failed to render page",
          );
        },
      },
    );
    timer = setTimeout(abort, streamTimeout + 1_000);
    request.signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        abort();
      },
      { once: true },
    );
    timer.unref();
  });
}

export const handleError: HandleErrorFunction = (error, { request }) => {
  if (!request.signal.aborted) {
    reportServerError(error, request);
    logger.error({ err: error, request_id: request.headers.get("x-request-id") }, "request failed");
  }
};
