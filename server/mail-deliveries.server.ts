import type { MailDeliveryOutcome } from "@/features/admin/mail/domain/delivery";
import { getDb } from "@/server/db/index.server";
import { mailDeliveries } from "@/server/db/schema";
import { logger } from "@/server/logger.server";

/**
 * Keeps the outcome for the panel's e-mail page. A database failure here never
 * blocks or fails the delivery itself: it only costs the history line.
 */
export async function recordMailDelivery(outcome: MailDeliveryOutcome): Promise<void> {
  try {
    await getDb().insert(mailDeliveries).values(outcome);
  } catch (error) {
    logger.warn(
      { failure: error instanceof Error ? error.name : "unknown", status: outcome.status },
      "e-mail delivery not recorded",
    );
  }
}
