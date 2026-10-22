import { purgeTeamInvitations } from "@/features/team/server/retention.server";
import { sweepAttachments } from "@/features/messages/server/attachments.server";
import { attachmentStorage } from "@/server/storage/attachment-storage.server";
import { closeGhostRooms } from "@/features/admin/live/server/close-ghost.server";
import { liveKitRoomNames } from "@/features/admin/live/server/livekit-rooms.server";
import { and, isNotNull, lt, sql } from "drizzle-orm";
import { purgeOldFailures } from "@/features/auth/server/lockout.server";
import type { Database } from "@/server/db/index.server";
import {
  adminSessions,
  appErrors,
  livekitEvents,
  mailDeliveries,
  roomJoinRequests,
  roomBans,
  roomParticipations,
  tokenRequests,
  userSessions,
} from "@/server/db/schema";
import { reprocessPendingEvents } from "@/features/room/server/webhook/projector.server";
import { purgeRoomControlHistory } from "@/features/room/server/control-retention.server";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Retention periods (docs/archive/admin-plan.md, LGPD). Access records are kept
 * 6 months (Marco Civil, art. 15); the rest only as long as it serves security.
 */
const RETENTION_DAYS = {
  tokenRequests: 183,
  participationIp: 183,
  participationName: 365,
  livekitEvents: 30,
  mailDeliveries: 30,
  appErrors: 30,
  loginFailures: 30,
  expiredSessions: 7,
  /** Requests to enter a room only matter for a few minutes; the name goes after a week. */
  joinRequests: 7,
  // A ban only holds while its call lasts; a week keeps it for anyone checking what happened.
  roomBans: 7,
} as const;

/**
 * Audit rows are kept 5 years. The app role has no DELETE on audit_logs: a database
 * function (migration 0025) deletes them, and the trigger refuses anything younger.
 */
async function purgeExpiredAuditLogs(db: Database): Promise<number> {
  const result = await db.execute<{ removed: number }>(
    sql`select purge_expired_audit_logs() as removed`,
  );
  return result.rows[0]?.removed ?? 0;
}

/** A freshly arrived event may still be being projected by the webhook itself. */
const REPROCESS_AFTER_MS = 60_000;

export interface MaintenanceReport {
  reprocessed: Awaited<ReturnType<typeof reprocessPendingEvents>>;
  tokenRequests: number;
  participationIps: number;
  participationNames: number;
  livekitEvents: number;
  mailDeliveries: number;
  appErrors: number;
  loginFailures: number;
  sessions: number;
  joinRequests: number;
  roomBans: number;
  auditLogs: number;
  attachments: number;
}

/**
 * Periodic tasks: re-projects LiveKit events that failed and applies
 * retention. Idempotent: running twice (e.g. two replicas during a
 * deploy) causes nothing beyond extra queries.
 */
export async function runMaintenance(db: Database, now = new Date()): Promise<MaintenanceReport> {
  const before = (days: number) => new Date(now.getTime() - days * DAY_MS);
  await purgeRoomControlHistory(db, now);
  await purgeTeamInvitations(db, now);

  const reprocessed = await reprocessPendingEvents(db, {
    receivedBefore: new Date(now.getTime() - REPROCESS_AFTER_MS),
  });

  const tokens = await db
    .delete(tokenRequests)
    .where(lt(tokenRequests.createdAt, before(RETENTION_DAYS.tokenRequests)))
    .returning({ id: tokenRequests.id });

  const ips = await db
    .update(roomParticipations)
    .set({ ip: null })
    .where(
      and(
        isNotNull(roomParticipations.ip),
        lt(roomParticipations.joinedAt, before(RETENTION_DAYS.participationIp)),
      ),
    )
    .returning({ id: roomParticipations.id });

  const names = await db
    .update(roomParticipations)
    .set({ displayName: null })
    .where(
      and(
        isNotNull(roomParticipations.displayName),
        lt(roomParticipations.joinedAt, before(RETENTION_DAYS.participationName)),
      ),
    )
    .returning({ id: roomParticipations.id });

  const events = await db
    .delete(livekitEvents)
    .where(lt(livekitEvents.receivedAt, before(RETENTION_DAYS.livekitEvents)))
    .returning({ id: livekitEvents.id });

  const mails = await db
    .delete(mailDeliveries)
    .where(lt(mailDeliveries.createdAt, before(RETENTION_DAYS.mailDeliveries)))
    .returning({ id: mailDeliveries.id });
  const errors = await db
    .delete(appErrors)
    .where(lt(appErrors.createdAt, before(RETENTION_DAYS.appErrors)))
    .returning({ id: appErrors.id });
  const bans = await db
    .delete(roomBans)
    .where(lt(roomBans.createdAt, before(RETENTION_DAYS.roomBans)))
    .returning({ id: roomBans.id });

  const auditLogs = await purgeExpiredAuditLogs(db);
  const attachments = await sweepAttachments(db, attachmentStorage(), now);

  const failures = await purgeOldFailures(db, now);

  const expired = before(RETENTION_DAYS.expiredSessions);
  const users = await db
    .delete(userSessions)
    .where(lt(userSessions.expiresAt, expired))
    .returning({ id: userSessions.id });
  const admins = await db
    .delete(adminSessions)
    .where(lt(adminSessions.expiresAt, expired))
    .returning({ id: adminSessions.id });

  const joins = await db
    .delete(roomJoinRequests)
    .where(lt(roomJoinRequests.createdAt, before(RETENTION_DAYS.joinRequests)))
    .returning({ id: roomJoinRequests.id });

  return {
    reprocessed,
    tokenRequests: tokens.length,
    participationIps: ips.length,
    participationNames: names.length,
    livekitEvents: events.length,
    mailDeliveries: mails.length,
    appErrors: errors.length,
    loginFailures: failures,
    sessions: users.length + admins.length,
    joinRequests: joins.length,
    roomBans: bans.length,
    auditLogs,
    attachments,
  };
}

const FIRST_RUN_DELAY_MS = 60_000;
const INTERVAL_MS = 6 * 60 * 60 * 1000;
/** Ghost rooms end within minutes: until then their people look "in a call". */
const GHOST_SWEEP_MS = 60_000;

/** Ends the rooms LiveKit dropped without telling (it restarted, say). */
async function sweepGhostRooms(db: Database, log: MaintenanceLog) {
  try {
    const closed = await closeGhostRooms(db, await liveKitRoomNames());
    if (closed > 0) log.info({ ghostRooms: closed }, "ghost rooms closed");
  } catch (error) {
    log.error({ err: error }, "ghost room sweep failed");
  }
}

/** Schedules maintenance in the server process (one replica; see docs/deployment.md). */
export function scheduleMaintenance(getDatabase: () => Database, log: MaintenanceLog) {
  let pending: Promise<void> | undefined;
  const maintain = async () => {
    try {
      log.info({ maintenance: await runMaintenance(getDatabase()) }, "maintenance completed");
    } catch (error) {
      log.error({ err: error }, "maintenance failed");
    }
  };
  const run = () => {
    pending ??= maintain().finally(() => {
      pending = undefined;
    });
  };
  const first = setTimeout(run, FIRST_RUN_DELAY_MS);
  const interval = setInterval(run, INTERVAL_MS);
  let sweeping: Promise<void> | undefined;
  const ghosts = setInterval(() => {
    sweeping ??= sweepGhostRooms(getDatabase(), log).finally(() => {
      sweeping = undefined;
    });
  }, GHOST_SWEEP_MS);
  first.unref();
  interval.unref();
  ghosts.unref();
  return async () => {
    clearTimeout(first);
    clearInterval(interval);
    clearInterval(ghosts);
    await Promise.all([pending, sweeping]);
  };
}

interface MaintenanceLog {
  info(details: object, message: string): void;
  error(details: object, message: string): void;
}
