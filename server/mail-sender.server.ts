import { eq } from "drizzle-orm";
import {
  effectiveSender,
  MAIL_SENDER_DEFAULTS,
  MAIL_SENDER_SETTING_KEY,
  mailSenderSchema,
  type MailSender,
} from "@/features/admin/mail/domain/sender";
import { getDb, type Database } from "@/server/db/index.server";
import { appSettings } from "@/server/db/schema";
import { getEnv } from "@/server/env.server";
import { logger } from "@/server/logger.server";

async function readSavedSender(db: Database) {
  const [row] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, MAIL_SENDER_SETTING_KEY));
  if (!row) return MAIL_SENDER_DEFAULTS;
  const parsed = mailSenderSchema.safeParse(row.value);
  if (!parsed.success) return MAIL_SENDER_DEFAULTS;
  return parsed.data;
}

/**
 * The sender for the next e-mail: the one saved in the panel or, without it, MAIL_FROM.
 * E-mails are rare (sign-up, new password), so it is read every time and a save applies at
 * once. With the database down, MAIL_FROM still lets the e-mail go out.
 */
export async function currentMailSender(db: Database = getDb()): Promise<MailSender> {
  const hosting = getEnv().MAIL_FROM;
  try {
    return effectiveSender(await readSavedSender(db), hosting);
  } catch (error) {
    logger.error({ err: error }, "failed to read the mail sender setting");
    return effectiveSender(MAIL_SENDER_DEFAULTS, hosting);
  }
}
