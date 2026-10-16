import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, type Database, type DbExecutor } from "@/server/db/index.server";
import { appSettings } from "@/server/db/schema";
import { logger } from "@/server/logger.server";
import {
  MAIL_SENDER_DEFAULTS,
  MAIL_SENDER_SETTING_KEY,
  mailSenderSchema,
  type MailSenderSettings,
} from "@/features/admin/mail/domain/sender";
import { MAX_ADMIN_LINKS } from "@/features/admin/participants/domain/admin-link";

/**
 * App settings edited in /admin. Each group is one row in
 * `app_settings` (key + JSON) with its own Zod schema and default values:
 * with the database down, no row or invalid JSON, the defaults apply.
 */
interface SettingGroup<T> {
  key: string;
  schema: z.ZodType<T>;
  defaults: T;
}

/** Mascot saturation per theme (CSS `saturate` filter): 0 = gray, 1 = original, 2 = vivid. */
export const MASCOT_SATURATION = { min: 0, max: 2, step: 0.05 } as const;

const SATURATION_RANGE = "A saturação precisa ficar entre 0% e 200%.";

const saturation = z
  .number()
  .min(MASCOT_SATURATION.min, SATURATION_RANGE)
  .max(MASCOT_SATURATION.max, SATURATION_RANGE)
  .transform((value) => Math.round(value * 100) / 100);

const mascotSchema = z.object({ saturationDark: saturation, saturationLight: saturation });

export type MascotSettings = z.infer<typeof mascotSchema>;

export const mascotSettings = {
  key: "mascot",
  schema: mascotSchema,
  defaults: { saturationDark: 1, saturationLight: 1 },
} satisfies SettingGroup<MascotSettings>;

/** Sender of the e-mails, typed in E-mails (owner only); null falls back to MAIL_FROM. */
export const mailSenderSettings = {
  key: MAIL_SENDER_SETTING_KEY,
  schema: mailSenderSchema,
  defaults: MAIL_SENDER_DEFAULTS,
} satisfies SettingGroup<MailSenderSettings>;

const adminLinkSchema = z.object({
  userIds: z.array(z.uuid()).max(MAX_ADMIN_LINKS, `Até ${MAX_ADMIN_LINKS} contas.`),
});

export type AdminLinkSettings = z.infer<typeof adminLinkSchema>;

/**
 * App accounts that show "Abrir o painel" in Configurações, picked one by one by the owner.
 * The link only opens the panel's own sign-in, which still asks for the 2FA code.
 */
export const adminLinkSettings = {
  key: "admin_link",
  schema: adminLinkSchema,
  defaults: { userIds: [] },
} satisfies SettingGroup<AdminLinkSettings>;

/**
 * In-memory cache, per process: the layout reads the mascot on every page and the
 * value almost never changes. Saving clears the cache; the TTL only bounds the delay
 * if there is ever more than one instance.
 */
const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { value: unknown; expiresAt: number }>();

/** Reports the read failure once per minute, not on every page. */
let lastReadErrorAt = 0;

async function readRaw(db: Database, key: string): Promise<unknown> {
  const [row] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, key));
  return row?.value;
}

/** `db`: connection to use (tests); when omitted, the app's connection is used. */
export async function getSetting<T>(group: SettingGroup<T>, db: Database = getDb()): Promise<T> {
  const hit = cache.get(group.key);
  if (hit && hit.expiresAt > Date.now()) {
    // The cache needs the same validation as values read from the database.
    const cached = group.schema.safeParse(hit.value);
    if (cached.success) return cached.data;
  }
  const stored = await readStoredSetting(group, db);
  // A database outage must not break the page: fall back to the default, without caching.
  if (!stored) return group.defaults;
  cache.set(group.key, { value: stored.value, expiresAt: Date.now() + CACHE_TTL_MS });
  return stored.value;
}

/** The stored value (or the default when it is invalid); `undefined` when the read failed. */
async function readStoredSetting<T>(
  group: SettingGroup<T>,
  db: Database,
): Promise<{ value: T } | undefined> {
  try {
    const parsed = group.schema.safeParse(await readRaw(db, group.key));
    return { value: parsed.success ? parsed.data : group.defaults };
  } catch (error) {
    if (Date.now() - lastReadErrorAt > 60_000) {
      lastReadErrorAt = Date.now();
      logger.error({ err: error, setting: group.key }, "failed to read setting");
    }
    return undefined;
  }
}

/**
 * Validates and writes (upsert). Throws `ZodError` for an invalid value. Accepts a
 * transaction to write together with the audit log; `updatedBy` = admin who changed it.
 */
export async function saveSetting<T>(
  group: SettingGroup<T>,
  input: unknown,
  db: DbExecutor = getDb(),
  updatedBy?: string,
): Promise<T> {
  const value = group.schema.parse(input);
  await db
    .insert(appSettings)
    .values({ key: group.key, value, updatedBy: updatedBy ?? null })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedBy: updatedBy ?? null, updatedAt: sql`now()` },
    });
  cache.delete(group.key);
  return value;
}

/** Clears the cache after the commit (the transaction may have written last). */
export function invalidateSetting(key: string) {
  cache.delete(key);
}

/** Tests only: forgets the cache between cases. */
export function clearSettingsCache() {
  cache.clear();
}
