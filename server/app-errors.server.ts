import { safePath, summarizeError } from "@/features/admin/errors/domain/error-summary";
import { getDb } from "@/server/db/index.server";
import { appErrors } from "@/server/db/schema";
import { logger } from "@/server/logger.server";

/** Keeps a safe summary of an unexpected error for the panel; never throws. */
export async function recordAppError(error: unknown, request: Request): Promise<void> {
  try {
    await getDb()
      .insert(appErrors)
      .values({
        requestId: request.headers.get("x-request-id")?.slice(0, 100) ?? null,
        method: request.method.slice(0, 10),
        path: safePath(request.url),
        ...summarizeError(error),
      });
  } catch (failure) {
    logger.warn(
      { failure: failure instanceof Error ? failure.name : "unknown" },
      "server error not recorded",
    );
  }
}
