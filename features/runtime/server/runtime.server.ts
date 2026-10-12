import { validateEnvOnBoot, getEnv } from "@/server/env.server";
import { closeDb, getDb } from "@/server/db/index.server";
import { logger } from "@/server/logger.server";
import { scheduleMaintenance } from "@/features/runtime/server/maintenance.server";
import type * as Sentry from "@sentry/react-router";
import { scheduleRoomControls } from "@/features/room/server/control-maintenance.server";
import { closeSignalConnections } from "@/features/room/server/signal-relay.server";

const runtime = globalThis as typeof globalThis & {
  nelcotaRuntime?: Promise<void>;
  nelcotaStopMaintenance?: () => Promise<void>;
  nelcotaStopRoomControls?: () => Promise<void>;
  nelcotaSentry?: typeof Sentry;
};

export function initializeRuntime(): Promise<void> {
  return (runtime.nelcotaRuntime ??= (async () => {
    const started = performance.now();
    validateEnvOnBoot();
    runtime.nelcotaStopMaintenance = scheduleMaintenance(getDb, logger);
    if (getEnv().ROOM_HOST_CONTROLS_ENABLED)
      runtime.nelcotaStopRoomControls = scheduleRoomControls(getDb);
    const dsn = getEnv().SENTRY_DSN;
    if (dsn) {
      const [sentry, { sentryOptions }] = await Promise.all([
        import("@sentry/react-router"),
        import("@/server/sentry.server"),
      ]);
      sentry.init(sentryOptions(dsn));
      runtime.nelcotaSentry = sentry;
    }
    logger.info(
      {
        startup: {
          runtimeMs: Math.round(performance.now() - started),
          sentryEnabled: Boolean(dsn),
        },
      },
      "runtime initialized",
    );
  })());
}

export function reportServerError(error: unknown, requestId?: string | null) {
  runtime.nelcotaSentry?.captureException(error, { tags: { request_id: requestId ?? undefined } });
}

export async function shutdownRuntime() {
  await runtime.nelcotaRuntime;
  await runtime.nelcotaStopMaintenance?.();
  await runtime.nelcotaStopRoomControls?.();
  closeSignalConnections();
  await closeDb();
  await runtime.nelcotaSentry?.close(2_000);
}
