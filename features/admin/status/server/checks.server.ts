import { desc, sql } from "drizzle-orm";
import type { DbExecutor } from "@/server/db/index.server";
import { getEnv } from "@/server/env.server";
import { logger } from "@/server/logger.server";
import { isValidSender } from "@/lib/mail-sender";
import { roomService } from "@/features/room/server/room-service.server";
import type { HealthCheck } from "@/features/admin/status/domain/health";
import type { LastDelivery } from "@/features/admin/status/domain/mail-health";
import { mailDeliveries } from "@/server/db/schema";

const CHECK_TIMEOUT_MS = 3_000;
const SLOW_DATABASE_MS = 500;

/** Rejects when the check takes longer than the page can wait. */
async function withTimeout<T>(work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), CHECK_TIMEOUT_MS);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export async function checkDatabase(db: DbExecutor): Promise<HealthCheck> {
  const started = performance.now();
  try {
    await withTimeout(db.execute(sql`select 1`));
  } catch (error) {
    logger.warn({ err: error }, "admin status: database unavailable");
    return { state: "down", detail: "Não respondeu." };
  }
  const latencyMs = Math.round(performance.now() - started);
  if (latencyMs > SLOW_DATABASE_MS) {
    return { state: "attention", detail: `Respondendo devagar: ${latencyMs} ms.` };
  }
  return { state: "ok", detail: `Respondeu em ${latencyMs} ms.` };
}

/** Rooms open in LiveKit right now; injectable so tests do not need a server. */
type ListLiveKitRooms = () => Promise<unknown[]>;

const listRoomsFromLiveKit: ListLiveKitRooms = () => roomService().listRooms();

export async function checkLiveKit(listRooms = listRoomsFromLiveKit): Promise<HealthCheck> {
  try {
    const rooms = await withTimeout(listRooms());
    const open = rooms.length === 1 ? "1 sala aberta" : `${rooms.length} salas abertas`;
    return { state: "ok", detail: `${open} agora.` };
  } catch (error) {
    logger.warn(
      { failure: error instanceof Error ? error.name : "unknown" },
      "admin status: LiveKit unavailable",
    );
    return { state: "down", detail: "Não respondeu." };
  }
}

interface MailEnvironment {
  RESEND_API_KEY?: string;
  SMTP_URL?: string;
  MAIL_FROM?: string;
}

function mailProvider(env: MailEnvironment): string | null {
  if (env.RESEND_API_KEY) return "Resend";
  if (env.SMTP_URL) return "SMTP";
  return null;
}

/** Only says what is configured; never the key, the SMTP URL or the sender address. */
export function checkMailConfiguration(env: MailEnvironment = getEnv()): HealthCheck {
  const provider = mailProvider(env);
  if (!provider) {
    return { state: "down", detail: "Nenhum provedor configurado." };
  }
  if (!env.MAIL_FROM) {
    return { state: "down", detail: "Falta MAIL_FROM." };
  }
  if (!isValidSender(env.MAIL_FROM)) {
    return { state: "down", detail: "MAIL_FROM em formato inválido." };
  }
  return { state: "ok", detail: `Enviando pelo ${provider}.` };
}

export interface DeployInfo {
  /** Commit the image was built from, or null outside CI builds. */
  version: string | null;
  /** Link to the commit when the version looks like a SHA. */
  commitUrl: string | null;
  /** When this server process started (the last deploy or restart). */
  startedAt: Date;
}

const REPOSITORY_URL = "https://github.com/Nelcota/NelcotaScreenShare";
const COMMIT_SHA = /^[0-9a-f]{7,40}$/i;

export function deployInfo(
  version: string | undefined,
  uptimeSeconds = process.uptime(),
  now = Date.now(),
): DeployInfo {
  const startedAt = new Date(now - uptimeSeconds * 1000);
  if (!version) return { version: null, commitUrl: null, startedAt };
  const commitUrl = COMMIT_SHA.test(version) ? `${REPOSITORY_URL}/commit/${version}` : null;
  return { version, commitUrl, startedAt };
}

/** The most recent e-mail send, or `null` when none was recorded yet. */
export async function lastMailDelivery(db: DbExecutor): Promise<LastDelivery | null> {
  const [last] = await db
    .select({ status: mailDeliveries.status, createdAt: mailDeliveries.createdAt })
    .from(mailDeliveries)
    .orderBy(desc(mailDeliveries.createdAt), desc(mailDeliveries.id))
    .limit(1);
  return last ?? null;
}
